import { useEffect, useRef } from 'react'
import { api, beaconContext } from './api'
import type { Context, View } from './types'

// Short UI tokens only (e.g. "tapped:track_rider"). No free text: this context is sent to Gemini.
const recent: string[] = []
export function recordAction(action: string): void {
  recent.unshift(action)
  recent.length = Math.min(recent.length, 5)
}

function buildContext(view: View, parcelId: string | null, locale: string): Context {
  return {
    view,
    parcel_id: parcelId,
    visible: document.visibilityState === 'visible',
    locale,
    local_hour: new Date().getHours(),
    recent_actions: [...recent],
  }
}

/** Tell the server where this tab is and whether it can be seen.
 *  Browsers keep SSE open in hidden tabs, so the connection alone cannot tell us. */
export function usePresence(userId: string, clientId: string, view: View, parcelId: string | null, locale: string) {
  const latest = useRef({ view, parcelId, locale })
  latest.current = { view, parcelId, locale }

  // Route changes: debounced.
  useEffect(() => {
    const t = window.setTimeout(() => {
      void api.postContext(userId, clientId, buildContext(view, parcelId, locale)).catch(() => {})
    }, 150)
    return () => window.clearTimeout(t)
  }, [userId, clientId, view, parcelId, locale])

  // Visibility: immediate. pagehide: beacon so it survives unload.
  useEffect(() => {
    const send = () => {
      const { view, parcelId, locale } = latest.current
      void api.postContext(userId, clientId, buildContext(view, parcelId, locale)).catch(() => {})
    }
    const hide = () => {
      const { view, parcelId, locale } = latest.current
      beaconContext(userId, clientId, { ...buildContext(view, parcelId, locale), visible: false })
    }
    document.addEventListener('visibilitychange', send)
    window.addEventListener('pagehide', hide)
    return () => {
      document.removeEventListener('visibilitychange', send)
      window.removeEventListener('pagehide', hide)
    }
  }, [userId, clientId])
}
