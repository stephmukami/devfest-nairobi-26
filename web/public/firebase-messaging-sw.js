/* Firebase Cloud Messaging service worker. Must live at the site root.
 *
 * Service workers cannot read Vite build-time env vars, so the (public) Firebase web
 * config is passed in the registration URL query string by src/lib/fcm.ts.
 */

// Registered before Firebase so our handler wins: open (or focus) the parcel screen.
self.addEventListener('notificationclick', (event) => {
  const n = event.notification
  const data = (n.data && n.data.FCM_MSG && n.data.FCM_MSG.data) || n.data || {}
  const link = new URL(data.deep_link || '/', self.location.origin).href
  event.stopImmediatePropagation()
  n.close()
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          try {
            await client.focus()
            client.postMessage({ type: 'shippy:navigate', link })
            return
          } catch (_) {
            /* fall through to openWindow */
          }
        }
      }
      await clients.openWindow(link)
    })(),
  )
})

// Red badge on the installed app icon (iOS Home Screen app, desktop). Runs alongside Firebase's
// own push handler, which shows the notification. Android launchers add their dot from the
// notification itself and do not support setAppBadge.
self.addEventListener('push', (event) => {
  let count = NaN
  try {
    count = Number(event.data.json().data.badge)
  } catch (_) {
    /* not one of ours */
  }
  if (count > 0 && self.navigator.setAppBadge) {
    event.waitUntil(self.navigator.setAppBadge(count).catch(() => {}))
  }
})

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

const params = new URL(self.location.href).searchParams
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain') || undefined,
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
})

// Messages carry a `notification` block, so FCM displays them automatically when the
// page is hidden. `tag` = parcel_id means a newer update replaces the older one.
firebase.messaging()
