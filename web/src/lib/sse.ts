import { useEffect, useRef, useState } from 'react'
import type { Delivery, Presence } from './types'

export type StreamStatus = 'connecting' | 'open' | 'closed'

// Dedupe across channels: SSE replay and FCM can both carry the same event_id.
const seen = new Set<string>()
export function markSeen(eventId: string): boolean {
  if (seen.has(eventId)) return false
  seen.add(eventId)
  if (seen.size > 500) seen.delete(seen.values().next().value as string)
  return true
}

let customerStreamOpen = false
/** True when this tab has a live (non-observer) SSE stream. FCM foreground messages defer to it. */
export const isSseConnected = () => customerStreamOpen

export function streamUrl(userId: string, clientId: string, observer: boolean): string {
  // Production: straight to Cloud Run (Hosting rewrites time out around 60 s).
  const base = (import.meta.env.VITE_STREAM_URL as string | undefined)?.replace(/\/$/, '') ?? ''
  const params = new URLSearchParams({ user_id: userId, client_id: clientId })
  if (observer) params.set('observer', 'true')
  return `${base}/api/stream?${params}`
}

interface Options {
  userId: string
  clientId: string
  observer?: boolean
  /** `fresh` is false when another channel (FCM) already showed this event: apply state, skip the toast. */
  onDelivery: (d: Delivery, fresh: boolean) => void
  onPresence?: (p: Presence) => void
}

export function useStream({ userId, clientId, observer = false, onDelivery, onPresence }: Options): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>('connecting')
  const deliveryRef = useRef(onDelivery)
  const presenceRef = useRef(onPresence)
  deliveryRef.current = onDelivery
  presenceRef.current = onPresence

  useEffect(() => {
    // EventSource reconnects on its own and sends Last-Event-ID, so the server replays the gap.
    const source = new EventSource(streamUrl(userId, clientId, observer))
    const localSeen = new Set<string>()
    setStatus('connecting')

    source.onopen = () => {
      setStatus('open')
      if (!observer) customerStreamOpen = true
    }
    source.onerror = () => {
      setStatus(source.readyState === EventSource.CLOSED ? 'closed' : 'connecting')
      if (!observer) customerStreamOpen = false
    }
    source.addEventListener('delivery', (e) => {
      const delivery = JSON.parse((e as MessageEvent).data) as Delivery
      if (localSeen.has(delivery.id)) return
      localSeen.add(delivery.id)
      deliveryRef.current(delivery, observer ? true : markSeen(delivery.id))
    })
    source.addEventListener('presence', (e) => {
      presenceRef.current?.(JSON.parse((e as MessageEvent).data) as Presence)
    })

    return () => {
      source.close()
      if (!observer) customerStreamOpen = false
    }
  }, [userId, clientId, observer])

  return status
}
