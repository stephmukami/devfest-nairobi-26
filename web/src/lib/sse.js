import { useEffect, useRef, useState } from 'react';
// Dedupe across channels: SSE replay and FCM can both carry the same event_id.
const seen = new Set();
export function markSeen(eventId) {
    if (seen.has(eventId))
        return false;
    seen.add(eventId);
    if (seen.size > 500)
        seen.delete(seen.values().next().value);
    return true;
}
let customerStreamOpen = false;
/** True when this tab has a live (non-observer) SSE stream. FCM foreground messages defer to it. */
export const isSseConnected = () => customerStreamOpen;
export function streamUrl(userId, clientId, observer) {
    // Production: straight to Cloud Run (Hosting rewrites time out around 60 s).
    const base = import.meta.env.VITE_STREAM_URL?.replace(/\/$/, '') ?? '';
    const params = new URLSearchParams({ user_id: userId, client_id: clientId });
    if (observer)
        params.set('observer', 'true');
    return `${base}/api/stream?${params}`;
}
export function useStream({ userId, clientId, observer = false, onDelivery, onPresence }) {
    const [status, setStatus] = useState('connecting');
    const deliveryRef = useRef(onDelivery);
    const presenceRef = useRef(onPresence);
    deliveryRef.current = onDelivery;
    presenceRef.current = onPresence;
    useEffect(() => {
        // EventSource reconnects on its own and sends Last-Event-ID, so the server replays the gap.
        const source = new EventSource(streamUrl(userId, clientId, observer));
        const localSeen = new Set();
        setStatus('connecting');
        source.onopen = () => {
            setStatus('open');
            if (!observer)
                customerStreamOpen = true;
        };
        source.onerror = () => {
            setStatus(source.readyState === EventSource.CLOSED ? 'closed' : 'connecting');
            if (!observer)
                customerStreamOpen = false;
        };
        source.addEventListener('delivery', (e) => {
            const delivery = JSON.parse(e.data);
            if (localSeen.has(delivery.id))
                return;
            localSeen.add(delivery.id);
            deliveryRef.current(delivery, observer ? true : markSeen(delivery.id));
        });
        source.addEventListener('presence', (e) => {
            presenceRef.current?.(JSON.parse(e.data));
        });
        return () => {
            source.close();
            if (!observer)
                customerStreamOpen = false;
        };
    }, [userId, clientId, observer]);
    return status;
}
