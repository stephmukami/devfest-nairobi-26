import { useCallback, useEffect, useState } from 'react'
import { ConnDot } from '@/components/ConnDot'
import { Inbox } from '@/components/Inbox'
import { cardButton, ParcelList, StatusBadge } from '@/components/ParcelList'
import { ParcelTimeline } from '@/components/ParcelTimeline'
import { clearToasts, showToast, type Toast } from '@/components/Toasts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import { api } from '@/lib/api'
import { recordAction, usePresence } from '@/lib/context'
import { currentAlertsState, enableAlerts, listenForeground, listenWorkerNavigation, type AlertsState } from '@/lib/fcm'
import { navigate, routeView, type Route } from '@/lib/route'
import { useStream } from '@/lib/sse'
import { tabClientId } from '@/lib/storage'
import type { AppConfig, Delivery, InboxItem, Parcel } from '@/lib/types'

interface Props {
  route: Route
  config: AppConfig
  userId: string
  onUserChange: (userId: string) => void
}

const clientId = tabClientId()

function openParcel(id: string) {
  recordAction(`opened_parcel:${id}`)
  navigate(`/parcels/${id}`)
}

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
      showToast(
        {
          id: d.id,
          title: d.message.title,
          body: d.message.body,
          icon: d.message.icon,
          priority: d.priority,
          sticky: d.decision.sticky,
          parcelId: (d.events.length === 1 ? (d.events[0].payload.parcel_id as string) : null) ?? null,
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

  return (
    <div className="mx-auto min-h-screen max-w-[560px] bg-card shadow-xl">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card px-4 py-2.5">
        <button className="flex items-center gap-2 text-lg font-extrabold" onClick={() => navigate('/')}>
          <img src="/icon.svg" alt="" width={28} height={28} /> Shippy
        </button>
        <nav className="ml-auto flex gap-1">
          <Button variant={route.name === 'orders' ? 'secondary' : 'ghost'} onClick={() => navigate('/orders')}>
            Orders
          </Button>
          <Button variant={route.name === 'payment' ? 'secondary' : 'ghost'} onClick={() => navigate('/payment')}>
            Payments
          </Button>
        </nav>
        <ConnDot status={status} label="Live updates" />
        <Inbox items={inbox} onOpenPanel={markRead} onOpenItem={(i) => i.parcel_id && openParcel(i.parcel_id)} />
      </header>

      <div className="flex items-center gap-3 border-b bg-muted px-4 py-2">
        <Select value={userId} onValueChange={onUserChange}>
          <SelectTrigger size="sm" className="bg-card" aria-label="Customer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {config.personas.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {ALERTS_NOTE[alerts] ? (
          <span className="text-sm text-muted-foreground">{ALERTS_NOTE[alerts]}</span>
        ) : (
          <Button size="sm" onClick={() => void enableAlerts(userId, true).then(setAlerts)}>
            Enable alerts
          </Button>
        )}
      </div>

      <main className="px-4 pt-5 pb-24">
        {route.name === 'home' && (
          <section>
            <h2 className="mb-1 text-xl font-semibold">Habari, {persona.name}</h2>
            <p className="text-muted-foreground">
              {onTheWay.length} parcel{onTheWay.length === 1 ? '' : 's'} on the way from{' '}
              {new Set(onTheWay.map((p) => p.store)).size} stores.
            </p>
            <div className="mt-3 grid gap-2">
              {needsAttention.map((p) => (
                <button key={p.parcel_id} className={cardButton} onClick={() => openParcel(p.parcel_id)}>
                  <strong className="font-semibold">{p.item}</strong> <StatusBadge status={p.status} />
                </button>
              ))}
            </div>
            <Button size="lg" className="mt-4" onClick={() => navigate('/orders')}>
              View orders
            </Button>
          </section>
        )}
        {route.name === 'orders' && <ParcelList parcels={parcels} onOpen={openParcel} />}
        {route.name === 'parcel' && (
          <ParcelTimeline parcel={parcel} flashId={flashId} onBack={() => navigate('/orders')} onPay={() => navigate('/payment')} />
        )}
        {route.name === 'payment' && (
          <section>
            <h2 className="mb-1 text-xl font-semibold">Payments</h2>
            {due.length === 0 && <p className="text-muted-foreground">No delivery fees due.</p>}
            {due.map((p) => (
              <div key={p.parcel_id} className="flex items-center justify-between gap-4 border-b py-3.5">
                <div className="grid">
                  <strong className="font-semibold">{p.item}</strong>
                  <span className="text-sm text-muted-foreground">{p.store}</span>
                </div>
                <Button size="lg" onClick={() => recordAction('tapped:pay_fee')}>
                  Pay KES {p.fee_kes}
                </Button>
              </div>
            ))}
          </section>
        )}
      </main>

      <Toaster position="bottom-center" visibleToasts={4} />
    </div>
  )
}
