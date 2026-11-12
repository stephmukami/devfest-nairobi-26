import { deviceId, load, save } from './storage'
import type {
  AppConfig,
  Context,
  Delivery,
  InboxItem,
  Parcel,
  Presence,
  SessionState,
  ShippyEvent,
  Switches,
} from './types'

const DEMO_KEY = 'shippy.demoKey'
export const getDemoKey = () => load(DEMO_KEY, '')
export const setDemoKey = (key: string) => save(DEMO_KEY, key)

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}, demo = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (demo && getDemoKey()) headers['X-Demo-Key'] = getDemoKey()
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as object) } })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json() as Promise<T>
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
const q = (userId: string) => `user_id=${encodeURIComponent(userId)}`

export const api = {
  config: () => request<AppConfig>('/api/config'),
  parcels: (userId: string) => request<Parcel[]>(`/api/parcels?${q(userId)}`),
  inbox: (userId: string) => request<InboxItem[]>(`/api/inbox?${q(userId)}`),
  markInboxRead: (userId: string) => request('/api/inbox/read', post({ user_id: userId })),
  presence: (userId: string) => request<Presence>(`/api/presence?${q(userId)}`),
  postContext: (userId: string, clientId: string, context: Context) =>
    request<SessionState>(
      '/api/session/context',
      post({ user_id: userId, client_id: clientId, device_id: deviceId(), context }),
    ),
  registerDevice: (userId: string, token: string) =>
    request('/api/devices', post({ user_id: userId, token, device_id: deviceId() })),
  unregisterDevice: (token: string) => request('/api/devices/unregister', post({ token })),

  // Demo controller (X-Demo-Key)
  emit: (userId: string, type: string, parcelId?: string) =>
    request<{ queued: boolean; event: ShippyEvent; delivery?: Delivery }>(
      '/api/demo/events',
      post({ user_id: userId, type, parcel_id: parcelId }),
      true,
    ),
  burst: (userId: string) =>
    request<{ coalesced: boolean; deliveries: Delivery[] }>('/api/demo/scenarios/burst', post({ user_id: userId }), true),
  getSettings: () => request<Switches>('/api/demo/settings', {}, true),
  putSettings: (update: Partial<Switches>) =>
    request<Switches>('/api/demo/settings', { method: 'PUT', body: JSON.stringify(update) }, true),
  reset: () => request('/api/demo/reset', post({}), true),
  deliveries: (userId: string) => request<Delivery[]>(`/api/demo/deliveries?${q(userId)}`, {}, true),
  /** Devices with alerts on, keyed by persona user_id. */
  devices: () => request<Record<string, number>>('/api/demo/devices', {}, true),
  clearDevices: () => request<{ cleared: number }>('/api/demo/devices/clear', post({}), true),
}

/** Best-effort context post that survives page unload (pagehide). Same-origin via /api. */
export function beaconContext(userId: string, clientId: string, context: Context): void {
  const body = JSON.stringify({ user_id: userId, client_id: clientId, device_id: deviceId(), context })
  try {
    if (navigator.sendBeacon?.('/api/session/context', new Blob([body], { type: 'application/json' }))) return
  } catch {
    /* fall through */
  }
  void fetch('/api/session/context', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } })
}
