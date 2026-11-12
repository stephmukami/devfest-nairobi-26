import { initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { api } from './api';
import { isSseConnected, markSeen } from './sse';
import { load, save } from './storage';
// Set when the customer turns alerts off in Settings, so loads and reconnects do not re-register.
const ALERTS_OFF_KEY = 'shippy.alertsOff';
const alertsTurnedOff = () => load(ALERTS_OFF_KEY, '') === '1';
const env = import.meta.env;
const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
};
const vapidKey = env.VITE_FIREBASE_VAPID_KEY;
export const fcmConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId && vapidKey);
/** iOS only delivers web push to a site added to the Home Screen and opened from its icon.
 *  Safari tabs, Chrome (CriOS) and the Google app on iPhone never get a push subscription. */
function iosNeedsInstall() {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    return ios && !standalone;
}
let app = null;
let messaging = null;
async function ensureMessaging() {
    if (!fcmConfigured || !('serviceWorker' in navigator) || !(await isSupported()))
        return null;
    app ?? (app = initializeApp(firebaseConfig));
    messaging ?? (messaging = getMessaging(app));
    return messaging;
}
async function registerWorker() {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(firebaseConfig))
        if (v)
            params.set(k, v);
    const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`);
    await navigator.serviceWorker.ready;
    return reg;
}
export async function currentAlertsState() {
    if (!fcmConfigured)
        return 'not_configured';
    if (iosNeedsInstall())
        return 'ios_install';
    if (!('Notification' in window) || !(await isSupported()))
        return 'unsupported';
    if (Notification.permission === 'granted' && alertsTurnedOff())
        return 'off';
    return Notification.permission;
}
/**
 * Get an FCM token and register it for the user.
 * `fromGesture` must be true only when called from a click: permission prompts need a user gesture.
 * Called on every load too (tokens are held in memory server-side, so a restart loses them),
 * except after the customer turned alerts off: only their own tap turns them back on.
 */
export async function enableAlerts(userId, fromGesture) {
    if (!fcmConfigured)
        return 'not_configured';
    if (iosNeedsInstall())
        return 'ios_install';
    if (!('Notification' in window))
        return 'unsupported';
    if (alertsTurnedOff()) {
        if (!fromGesture)
            return Notification.permission === 'granted' ? 'off' : Notification.permission;
        save(ALERTS_OFF_KEY, '');
    }
    // Ask before any await: Safari drops the click's user activation across async hops
    // and then refuses the prompt.
    let permission = Notification.permission;
    if (permission === 'default' && fromGesture)
        permission = await Notification.requestPermission();
    const m = await ensureMessaging();
    if (!m)
        return 'unsupported';
    if (permission !== 'granted')
        return permission;
    try {
        const serviceWorkerRegistration = await registerWorker();
        const token = await getToken(m, { vapidKey, serviceWorkerRegistration });
        if (!token)
            return 'error';
        await api.registerDevice(userId, token);
        return 'granted';
    }
    catch (err) {
        console.error('FCM registration failed', err);
        return 'error';
    }
}
/** Turn alerts off on this device: drop its push subscription and tell the server to forget it.
 *  The browser permission stays, so turning alerts back on needs no prompt. */
export async function disableAlerts() {
    save(ALERTS_OFF_KEY, '1');
    syncAppBadge(0);
    const m = await ensureMessaging();
    if (!m || Notification.permission !== 'granted')
        return currentAlertsState();
    try {
        const serviceWorkerRegistration = await registerWorker();
        const token = await getToken(m, { vapidKey, serviceWorkerRegistration });
        if (token)
            await api.unregisterDevice(token);
        await deleteToken(m);
    }
    catch (err) {
        // The flag is saved, so this device will not re-register; a stale server token is removed on its next failed send.
        console.error('FCM unregister failed', err);
    }
    return 'off';
}
/** Foreground messages: ignore when SSE is connected (it already delivered), dedupe by event_id. */
export function listenForeground(cb) {
    let unsub = null;
    let cancelled = false;
    void ensureMessaging().then((m) => {
        if (!m || cancelled)
            return;
        unsub = onMessage(m, (payload) => {
            const data = payload.data ?? {};
            const eventId = data.event_id;
            if (!eventId || isSseConnected() || !markSeen(eventId))
                return;
            cb({
                eventId,
                title: payload.notification?.title ?? 'Shippy',
                body: payload.notification?.body ?? '',
                icon: data.icon ?? 'bell',
                parcelId: data.parcel_id || null,
                priority: data.priority ?? 'info',
            });
        });
    });
    return () => {
        cancelled = true;
        unsub?.();
    };
}
/** Badging API: a red count on the installed app's icon (iOS Home Screen app, desktop PWA).
 *  Android Chrome lacks it; launchers there draw a dot from the notification instead. */
export function syncAppBadge(count) {
    const nav = navigator;
    if (!nav.setAppBadge || !('Notification' in window) || Notification.permission !== 'granted')
        return;
    const done = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.();
    void done?.catch(() => { });
}
/** The service worker asks an open tab to navigate when a notification is clicked. */
export function listenWorkerNavigation(navigate) {
    if (!('serviceWorker' in navigator))
        return () => { };
    const handler = (e) => {
        if (e.data?.type === 'shippy:navigate' && typeof e.data.link === 'string') {
            const url = new URL(e.data.link, window.location.origin);
            navigate(url.pathname);
        }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
}
