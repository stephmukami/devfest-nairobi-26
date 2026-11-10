import { useCallback, useEffect, useRef, useState } from 'react'
import { ConnDot } from '@/components/ConnDot'
import { Inbox } from '@/components/Inbox'
import { cardButton, ParcelList, StatusBadge } from '@/components/ParcelList'
import { ParcelTimeline } from '@/components/ParcelTimeline'
import { clearToasts, showToast, type Toast } from '@/components/Toasts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import { api } from '@/lib/api'
import { recordAction, usePresence } from '@/lib/context'
import { currentAlertsState, enableAlerts, listenForeground, listenWorkerNavigation, type AlertsState } from '@/lib/fcm'
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
  const needsAttention = parcels.filter((p) => ['payment_due', 'needs_address', 'failed', 'delayed'].includes(p.status))
  const onTheWay = parcels.filter((p) => p.status !== 'delivered')
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
          <nav className="ml-2 flex gap-1 sm:ml-6">
            <Button variant={route.name === 'home' ? 'secondary' : 'ghost'} onClick={() => navigate('/')} className="hidden sm:inline-flex">
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
        {route.name === 'home' && (
          <section>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Habari, {persona.name}</h1>
            <p className="mt-1 text-muted-foreground">
              {onTheWay.length} parcel{onTheWay.length === 1 ? '' : 's'} on the way from{' '}
              {new Set(onTheWay.map((p) => p.store)).size} stores, delivered together by Shippy.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: 'On the way', value: onTheWay.length, tone: 'text-foreground', to: '/orders' },
                { label: 'Need attention', value: needsAttention.length, tone: 'text-action', to: '/orders' },
                { label: 'Fees due', value: due.length, tone: 'text-critical', to: '/payment' },
              ].map((s) => (
                <button key={s.label} className={cn(cardButton, 'grid justify-items-start gap-0.5 p-4')} onClick={() => navigate(s.to)}>
                  <span className={cn('text-2xl font-bold sm:text-3xl', s.tone)}>{s.value}</span>
                  <span className="text-xs text-muted-foreground sm:text-sm">{s.label}</span>
                </button>
              ))}
            </div>

            {needsAttention.length > 0 && (
              <>
                <h2 className="mt-8 mb-3 text-lg font-semibold">Needs your attention</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {needsAttention.map((p) => (
                    <button key={p.parcel_id} className={cardButton} onClick={() => openParcel(p.parcel_id)}>
                      <span className="grid min-w-0">
                        <strong className="truncate font-semibold">{p.item}</strong>
                        <span className="truncate text-muted-foreground">{p.store}</span>
                      </span>
                      <StatusBadge status={p.status} />
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="mt-8 mb-3 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Your parcels</h2>
              <Button variant="link" className="px-0" onClick={() => navigate('/orders')}>
                View all orders
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {parcels.map((p) => (
                <button key={p.parcel_id} className={cn(cardButton, 'items-start')} onClick={() => openParcel(p.parcel_id)}>
                  <span className="grid min-w-0">
                    <strong className="truncate font-semibold">{p.item}</strong>
                    <span className="truncate text-muted-foreground">
                      {p.store} · {p.parcel_id}
                    </span>
                    {p.eta_minutes != null && p.status !== 'delivered' && (
                      <span className="mt-1 text-sm font-semibold">~{p.eta_minutes} min</span>
                    )}
                  </span>
                  <StatusBadge status={p.status} />
                </button>
              ))}
            </div>
          </section>
        )}

        {split && (
          // Desktop: list and detail side by side. Phone: one at a time (the route decides which).
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
            <div className={cn(route.name === 'parcel' && 'hidden lg:block', 'lg:sticky lg:top-20')}>
              <ParcelList parcels={parcels} onOpen={openParcel} selectedId={parcelId} />
            </div>
            <div className={cn(route.name === 'orders' && 'hidden lg:block')}>
              {route.name === 'parcel' ? (
                <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
                  <ParcelTimeline parcel={parcel} flashId={flashId} onBack={() => navigate('/orders')} />
                </div>
              ) : (
                <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
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
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-card px-4 py-3.5 ring-1 ring-foreground/10"
                >
                  <div className="grid">
                    <strong className="font-semibold">{p.item}</strong>
                    <span className="text-sm text-muted-foreground">
                      {p.store} · {p.parcel_id}
                    </span>
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

      <Toaster position="bottom-right" visibleToasts={4} />
    </div>
  )
}
