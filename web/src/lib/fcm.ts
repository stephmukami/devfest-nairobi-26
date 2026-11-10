import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging'
import { api } from './api'
import { isSseConnected, markSeen } from './sse'

const env = import.meta.env
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
}
const vapidKey = env.VITE_FIREBASE_VAPID_KEY as string | undefined

export const fcmConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId && vapidKey,
)

export type AlertsState = 'not_configured' | 'unsupported' | 'ios_install' | 'default' | 'denied' | 'granted' | 'error'

/** iOS only delivers web push to a site added to the Home Screen and opened from its icon.
 *  Safari tabs, Chrome (CriOS) and the Google app on iPhone never get a push subscription. */
function iosNeedsInstall(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  return ios && !standalone
}

let app: FirebaseApp | null = null
let messaging: Messaging | null = null

async function ensureMessaging(): Promise<Messaging | null> {
  if (!fcmConfigured || !('serviceWorker' in navigator) || !(await isSupported())) return null
  app ??= initializeApp(firebaseConfig)
  messaging ??= getMessaging(app)
  return messaging
}

async function registerWorker(): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(firebaseConfig)) if (v) params.set(k, v)
  const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`)
  await navigator.serviceWorker.ready
  return reg
}

export async function currentAlertsState(): Promise<AlertsState> {
  if (!fcmConfigured) return 'not_configured'
  if (iosNeedsInstall()) return 'ios_install'
  if (!('Notification' in window) || !(await isSupported())) return 'unsupported'
  return Notification.permission as AlertsState
}

/**
 * Get an FCM token and register it for the user.
 * `fromGesture` must be true only when called from a click: permission prompts need a user gesture.
 * Called on every load too (tokens are held in memory server-side, so a restart loses them).
 */
export async function enableAlerts(userId: string, fromGesture: boolean): Promise<AlertsState> {
  if (!fcmConfigured) return 'not_configured'
  if (iosNeedsInstall()) return 'ios_install'
  if (!('Notification' in window)) return 'unsupported'
  // Ask before any await: Safari drops the click's user activation across async hops
  // and then refuses the prompt.
  let permission = Notification.permission
  if (permission === 'default' && fromGesture) permission = await Notification.requestPermission()
  const m = await ensureMessaging()
  if (!m) return 'unsupported'
  if (permission !== 'granted') return permission as AlertsState
  try {
    const serviceWorkerRegistration = await registerWorker()
    const token = await getToken(m, { vapidKey, serviceWorkerRegistration })
    if (!token) return 'error'
    await api.registerDevice(userId, token)
    return 'granted'
  } catch (err) {
    console.error('FCM registration failed', err)
    return 'error'
  }
}

export interface ForegroundPush {
  eventId: string
  title: string
  body: string
  icon: string
  parcelId: string | null
  priority: string
}

/** Foreground messages: ignore when SSE is connected (it already delivered), dedupe by event_id. */
export function listenForeground(cb: (p: ForegroundPush) => void): () => void {
  let unsub: (() => void) | null = null
  let cancelled = false
  void ensureMessaging().then((m) => {
    if (!m || cancelled) return
    unsub = onMessage(m, (payload) => {
      const data = payload.data ?? {}
      const eventId = data.event_id
      if (!eventId || isSseConnected() || !markSeen(eventId)) return
      cb({
        eventId,
        title: payload.notification?.title ?? 'Shippy',
        body: payload.notification?.body ?? '',
        icon: data.icon ?? 'bell',
        parcelId: data.parcel_id || null,
        priority: data.priority ?? 'info',
      })
    })
  })
  return () => {
    cancelled = true
    unsub?.()
  }
}

/** Badging API: a red count on the installed app's icon (iOS Home Screen app, desktop PWA).
 *  Android Chrome lacks it; launchers there draw a dot from the notification instead. */
export function syncAppBadge(count: number): void {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  if (!nav.setAppBadge || !('Notification' in window) || Notification.permission !== 'granted') return
  const done = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.()
  void done?.catch(() => {})
}

/** The service worker asks an open tab to navigate when a notification is clicked. */
export function listenWorkerNavigation(navigate: (path: string) => void): () => void {
  if (!('serviceWorker' in navigator)) return () => {}
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'shippy:navigate' && typeof e.data.link === 'string') {
      const url = new URL(e.data.link, window.location.origin)
      navigate(url.pathname)
    }
  }
  navigator.serviceWorker.addEventListener('message', handler)
  return () => navigator.serviceWorker.removeEventListener('message', handler)
}
