// Storage can throw (private mode, blocked site data). Never let that break the demo.

export function load(key: string, fallback: string, store: 'local' | 'session' = 'local'): string {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage
    return s.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: string, store: 'local' | 'session' = 'local'): void {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage
    s.setItem(key, value)
  } catch {
    /* ignore */
  }
}

/** One id per page load. Not sessionStorage: duplicated tabs copy it and would share presence. */
const pageClientId = 'tab_' + Math.random().toString(36).slice(2, 12)
export const tabClientId = (): string => pageClientId

/** One id per browser (localStorage), shared by its tabs. The server uses it to skip pushing to the
 *  browser that is already showing the toast, and to replace this browser's older FCM token. */
const DEVICE_KEY = 'shippy.deviceId'
let deviceIdCache = ''
export function deviceId(): string {
  if (deviceIdCache) return deviceIdCache
  let id = load(DEVICE_KEY, '')
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) {
    id = 'dev_' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6)
    save(DEVICE_KEY, id)
  }
  deviceIdCache = id
  return id
}
