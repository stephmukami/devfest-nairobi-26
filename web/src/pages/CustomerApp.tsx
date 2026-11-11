import { useCallback, useEffect, useRef, useState } from 'react'
import { ConnDot } from '@/components/ConnDot'
import { HomeDashboard } from '@/components/HomeDashboard'
import { Inbox } from '@/components/Inbox'
import { ParcelList } from '@/components/ParcelList'
import { ParcelThumb } from '@/components/ParcelThumb'
import { ParcelTimeline } from '@/components/ParcelTimeline'
import { clearToasts, showToast, type Toast } from '@/components/Toasts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import { api } from '@/lib/api'
import { recordAction, usePresence } from '@/lib/context'
import {
  currentAlertsState,
  enableAlerts,
  listenForeground,
  listenWorkerNavigation,
  syncAppBadge,
  type AlertsState,
} from '@/lib/fcm'
import { Icon } from '@/lib/icons'
import { openParcel, parcelCta } from '@/lib/parcelActions'
import { navigate, routeView, type Route } from '@/lib/route'
import { useStream } from '@/lib/sse'
import { tabClientId } from '@/lib/storage'
import type { AppConfig, Delivery, InboxItem, Parcel } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  route: Route
  config: AppConfig
  userId: string
  onUserChange: (userId: string) => void
}

const clientId = tabClientId()

const TABS = [
  { label: 'Home', to: '/', icon: 'home', match: ['home'] },
  { label: 'Orders', to: '/orders', icon: 'package', match: ['orders', 'parcel'] },
  { label: 'Payments', to: '/payment', icon: 'payments', match: ['payment'] },
] as const

function openFromToast(t: Toast) {
  if (t.parcelId) openParcel(t.parcelId)
}

const ALERTS_NOTE: Partial<Record<AlertsState, string>> = {
  granted: 'Alerts on',
  denied: 'Alerts blocked in browser settings',
  not_configured: 'Push not configured',
  unsupported: 'Push unsupported in this browser',
  ios_install: 'For alerts on iPhone: open in Safari, Share → Add to Home Screen, then open Shippy from the icon',
}

export function CustomerApp({ route, config, userId, onUserChange }: Props) {
  const persona = config.personas.find((p) => p.user_id === userId) ?? config.personas[0]
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [flashId, setFlashId] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<AlertsState>('default')
  // Latest parcels for the FCM foreground listener, which is registered once.
  const parcelsRef = useRef(parcels)
  parcelsRef.current = parcels

  const parcelId = route.name === 'parcel' ? route.parcelId : null
  usePresence(userId, clientId, routeView(route), parcelId, persona.locale)

  const reload = useCallback(() => {
    api.parcels(userId).then(setParcels).catch(() => {})
    api.inbox(userId).then(setInbox).catch(() => {})
  }, [userId])

  useEffect(() => {
    clearToasts()
    reload()
  }, [reload])

  // Re-register the FCM token on every load: keeps it fresh (and recreates it if the server lost it).
  useEffect(() => {
    void currentAlertsState().then((state) => {
      setAlerts(state)
      if (state === 'granted') void enableAlerts(userId, false).then(setAlerts)
    })
  }, [userId])

  useEffect(() => listenWorkerNavigation(navigate), [])

  // App icon badge (installed app): mirror the inbox, so reading it clears the red dot.
  const unread = inbox.filter((i) => !i.read).length
  useEffect(() => syncAppBadge(unread), [unread])

  useEffect(
    () =>
      listenForeground((p) =>
        showToast(
          {
            id: p.eventId,
            title: p.title,
            body: p.body,
            icon: p.icon,
            priority: p.priority as Toast['priority'],
            sticky: p.priority === 'critical',
            parcelId: p.parcelId,
            cta: parcelCta(parcelsRef.current.find((x) => x.parcel_id === p.parcelId)),
            via: 'fcm',
          },
          openFromToast,
        ),
      ),
    [],
  )

  const onDelivery = useCallback((d: Delivery, fresh: boolean) => {
    if (d.parcels.length) {
      setParcels((ps) => ps.map((p) => d.parcels.find((u) => u.parcel_id === p.parcel_id) ?? p))
    }
    if (d.inbox_item) {
      const item = d.inbox_item
      setInbox((items) => (items.some((i) => i.event_id === item.event_id) ? items : [item, ...items]))
    }
    if (d.decision.action === 'inline') {
      setFlashId(d.events[d.events.length - 1].event_id)
    }
    if (fresh && d.decision.action === 'toast' && d.message) {
      const toastParcelId = (d.events.length === 1 ? (d.events[0].payload.parcel_id as string) : null) ?? null
      showToast(
        {
          id: d.id,
          title: d.message.title,
          body: d.message.body,
          icon: d.message.icon,
          priority: d.priority,
          sticky: d.decision.sticky,
          parcelId: toastParcelId,
          // The delivery carries the parcel as it is after this event.
          cta: parcelCta(d.parcels.find((x) => x.parcel_id === toastParcelId)),
          via: 'sse',
        },
        openFromToast,
      )
    }
    // 'push' is delivered by FCM; 'inbox_only' just bumps the badge via inbox_item.
  }, [])

  const status = useStream({ userId, clientId, onDelivery })

  const markRead = () => {
    void api.markInboxRead(userId).catch(() => {})
    setInbox((items) => items.map((i) => ({ ...i, read: true })))
  }

  const parcel = parcels.find((p) => p.parcel_id === parcelId)
  const due = parcels.filter((p) => p.status === 'payment_due')

  const container = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10'
  const split = route.name === 'orders' || route.name === 'parcel'

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className={cn(container, 'flex h-14 items-center gap-2 sm:gap-4')}>
          <button className="flex items-center gap-2 text-lg font-extrabold" onClick={() => navigate('/')}>
            <img src="/icon.svg" alt="" width={28} height={28} /> <span className="hidden sm:inline">Shippy</span>
          </button>
          {/* Phones use the bottom tab bar instead. */}
          <nav className="ml-6 hidden gap-1 sm:flex">
            <Button variant={route.name === 'home' ? 'secondary' : 'ghost'} onClick={() => navigate('/')}>
              Home
            </Button>
            <Button variant={split ? 'secondary' : 'ghost'} onClick={() => navigate('/orders')}>
              Orders
            </Button>
            <Button variant={route.name === 'payment' ? 'secondary' : 'ghost'} onClick={() => navigate('/payment')}>
              Payments
            </Button>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ConnDot status={status} label="Live updates" />
            <Inbox
              items={inbox}
              parcels={parcels}
              onMarkAllRead={markRead}
              onOpenItem={(i) => i.parcel_id && openParcel(i.parcel_id)}
            />
            <Select value={userId} onValueChange={onUserChange}>
              <SelectTrigger className="gap-2 border-0 bg-transparent px-1.5 shadow-none" aria-label="Customer">
                <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {persona.name.charAt(0)}
                </span>
                <span className="hidden font-medium md:inline">{persona.name}</span>
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                {config.personas.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {alerts !== 'granted' && (
        <div className="border-b bg-muted">
          <div className={cn(container, 'flex flex-wrap items-center gap-3 py-2 text-sm')}>
            {ALERTS_NOTE[alerts] ? (
              <span className="text-muted-foreground">{ALERTS_NOTE[alerts]}</span>
            ) : (
              <>
                <span className="text-muted-foreground">Get delivery updates even when this tab is closed.</span>
                <Button size="sm" onClick={() => void enableAlerts(userId, true).then(setAlerts)}>
                  Enable alerts
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <main className={cn(container, 'flex-1 pt-6 pb-24 lg:pt-8')}>
        {route.name === 'home' && <HomeDashboard persona={persona} parcels={parcels} onOpenParcel={openParcel} />}

        {split && (
          // Desktop: list and detail side by side. Phone: one at a time (the route decides which).
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
            <div className={cn(route.name === 'parcel' && 'hidden lg:block', 'lg:sticky lg:top-20')}>
              <ParcelList parcels={parcels} onOpen={openParcel} selectedId={parcelId} />
            </div>
            <div className={cn(route.name === 'orders' && 'hidden lg:block')}>
              {route.name === 'parcel' ? (
                <div className="rounded-lg bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
                  <ParcelTimeline parcel={parcel} flashId={flashId} onBack={() => navigate('/orders')} />
                </div>
              ) : (
                <div className="grid min-h-64 place-items-center rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  Select a parcel to see its timeline.
                </div>
              )}
            </div>
          </div>
        )}

        {route.name === 'payment' && (
          <section className="max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
            {due.length === 0 && <p className="mt-1 text-muted-foreground">No delivery fees due.</p>}
            <div className="mt-4 grid gap-3">
              {due.map((p) => (
                <div
                  key={p.parcel_id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-card px-4 py-3.5 ring-1 ring-foreground/10"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ParcelThumb parcel={p} />
                    <div className="grid min-w-0">
                      <strong className="truncate font-semibold">{p.item}</strong>
                      <span className="truncate text-sm text-muted-foreground">
                        {p.store} · {p.parcel_id}
                      </span>
                    </div>
                  </div>
                  <Button size="lg" onClick={() => recordAction('tapped:pay_fee')}>
                    Pay KES {p.fee_kes}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        aria-label="Main"
      >
        {TABS.map((t) => {
          const active = (t.match as readonly string[]).includes(route.name)
          return (
            <button
              key={t.label}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 text-xs font-medium',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(t.to)}
            >
              <Icon name={t.icon} size={22} />
              {t.label}
            </button>
          )
        })}
      </nav>

      <Toaster position="bottom-right" visibleToasts={4} />
    </div>
  )
}
