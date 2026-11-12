import { deviceId, load, save } from './storage';
const DEMO_KEY = 'shippy.demoKey';
export const getDemoKey = () => load(DEMO_KEY, '');
export const setDemoKey = (key) => save(DEMO_KEY, key);
export class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
async function request(path, init = {}, demo = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (demo && getDemoKey())
        headers['X-Demo-Key'] = getDemoKey();
    const res = await fetch(path, { ...init, headers: { ...headers, ...init.headers } });
    if (!res.ok) {
        let detail = res.statusText;
        try {
            detail = (await res.json()).detail ?? detail;
        }
        catch {
            /* not json */
        }
        throw new ApiError(res.status, typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    return res.json();
}
const post = (body) => ({ method: 'POST', body: JSON.stringify(body) });
const q = (userId) => `user_id=${encodeURIComponent(userId)}`;
export const api = {
    config: () => request('/api/config'),
    parcels: (userId) => request(`/api/parcels?${q(userId)}`),
    inbox: (userId) => request(`/api/inbox?${q(userId)}`),
    markInboxRead: (userId) => request('/api/inbox/read', post({ user_id: userId })),
    presence: (userId) => request(`/api/presence?${q(userId)}`),
    postContext: (userId, clientId, context) => request('/api/session/context', post({ user_id: userId, client_id: clientId, device_id: deviceId(), context })),
    registerDevice: (userId, token) => request('/api/devices', post({ user_id: userId, token, device_id: deviceId() })),
    unregisterDevice: (token) => request('/api/devices/unregister', post({ token })),
    // Demo controller (X-Demo-Key)
    emit: (userId, type, parcelId) => request('/api/demo/events', post({ user_id: userId, type, parcel_id: parcelId }), true),
    burst: (userId) => request('/api/demo/scenarios/burst', post({ user_id: userId }), true),
    getSettings: () => request('/api/demo/settings', {}, true),
    putSettings: (update) => request('/api/demo/settings', { method: 'PUT', body: JSON.stringify(update) }, true),
    reset: () => request('/api/demo/reset', post({}), true),
    deliveries: (userId) => request(`/api/demo/deliveries?${q(userId)}`, {}, true),
    /** Devices with alerts on, keyed by persona user_id. */
    devices: () => request('/api/demo/devices', {}, true),
    clearDevices: () => request('/api/demo/devices/clear', post({}), true),
};
/** Best-effort context post that survives page unload (pagehide). Same-origin via /api. */
export function beaconContext(userId, clientId, context) {
    const body = JSON.stringify({ user_id: userId, client_id: clientId, device_id: deviceId(), context });
    try {
        if (navigator.sendBeacon?.('/api/session/context', new Blob([body], { type: 'application/json' })))
            return;
    }
    catch {
        /* fall through */
    }
    void fetch('/api/session/context', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } });
}
