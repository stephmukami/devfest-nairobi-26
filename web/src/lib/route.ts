import { useEffect, useState } from 'react'
import type { View } from './types'

export type Route =
  | { name: 'home' }
  | { name: 'orders' }
  | { name: 'parcel'; parcelId: string }
  | { name: 'payment' }
  | { name: 'stage' }

export function parse(path: string): Route {
  const parcel = path.match(/^\/parcels\/(SHP-\d{5})\/?$/)
  if (parcel) return { name: 'parcel', parcelId: parcel[1] }
  if (path.startsWith('/orders')) return { name: 'orders' }
  if (path.startsWith('/payment')) return { name: 'payment' }
  if (path.startsWith('/stage')) return { name: 'stage' }
  return { name: 'home' }
}

export function routeView(route: Route): View {
  switch (route.name) {
    case 'orders':
      return 'orders_list'
    case 'parcel':
      return 'parcel_detail'
    case 'payment':
      return 'payment'
    default:
      return 'home'
  }
}

export function navigate(path: string): void {
  if (path === window.location.pathname) return
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.pathname))
  useEffect(() => {
    const onPop = () => setRoute(parse(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return route
}
