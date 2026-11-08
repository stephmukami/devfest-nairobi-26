import { useCallback, useEffect, useState } from 'react'
import { Inbox } from '../components/Inbox'
import { ParcelList, StatusBadge } from '../components/ParcelList'
import { ParcelTimeline } from '../components/ParcelTimeline'
import { ToastStack, type Toast } from '../components/ToastStack'
import { api } from '../lib/api'
import { recordAction, usePresence } from '../lib/context'
import { currentAlertsState, enableAlerts, listenForeground, listenWorkerNavigation, type AlertsState } from '../lib/fcm'
import { navigate, routeView, type Route } from '../lib/route'
import { useStream } from '../lib/sse'
import { tabClientId } from '../lib/storage'
import type { AppConfig, Delivery, InboxItem, Parcel } from '../lib/types'

interface Props {
  route: Route
  config: AppConfig
  userId: string
  onUserChange: (userId: string) => void
}

const clientId = tabClientId()

export function CustomerApp({ route, config, userId, onUserChange }: Props) {
  const persona = config.personas.find((p) => p.user_id === userId) ?? config.personas[0]
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [flashId, setFlashId] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<AlertsState>('default')

  const parcelId = route.name === 'parcel' ? route.parcelId : null
  usePresence(userId, clientId, routeView(route), parcelId, persona.locale)

  const reload = useCallback(() => {
    api.parcels(userId).then(setParcels).catch(() => {})
    api.inbox(userId).then(setInbox).catch(() => {})
  }, [userId])

  useEffect(() => {
    setToasts([])
    reload()
  }, [reload])

  // Re-register the FCM token on every load: the server holds tokens in memory.
  useEffect(() => {
    void currentAlertsState().then((state) => {
      setAlerts(state)
      if (state === 'granted') void enableAlerts(userId, false).then(setAlerts)
    })
  }, [userId])

  useEffect(() => listenWorkerNavigation(navigate), [])

  const addToast = useCallback((t: Toast) => setToasts((ts) => [t, ...ts.filter((x) => x.id !== t.id)].slice(0, 4)), [])

  useEffect(
    () =>
      listenForeground((p) =>
        addToast({
          id: p.eventId,
          title: p.title,
          body: p.body,
          icon: p.icon,
          priority: p.priority as Toast['priority'],
          sticky: p.priority === 'critical',
          parcelId: p.parcelId,
          via: 'fcm',
        }),
      ),
    [addToast],
  )

  const onDelivery = useCallback(
    (d: Delivery, fresh: boolean) => {
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
        addToast({
          id: d.id,
          title: d.message.title,
          body: d.message.body,
          icon: d.message.icon,
          priority: d.priority,
          sticky: d.decision.sticky,
          parcelId: (d.events.length === 1 ? (d.events[0].payload.parcel_id as string) : null) ?? null,
          via: 'sse',
        })
      }
      // 'push' is delivered by FCM; 'inbox_only' just bumps the badge via inbox_item.
    },
    [addToast],
  )

  const status = useStream({ userId, clientId, onDelivery })

  const dismiss = useCallback((id: string) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const openParcel = (id: string) => {
    recordAction(`opened_parcel:${id}`)
    navigate(`/parcels/${id}`)
  }

  const markRead = () => {
    void api.markInboxRead(userId).catch(() => {})
    setInbox((items) => items.map((i) => ({ ...i, read: true })))
  }

  const parcel = parcels.find((p) => p.parcel_id === parcelId)
  const needsAttention = parcels.filter((p) => ['payment_due', 'needs_address', 'failed', 'delayed'].includes(p.status))
  const onTheWay = parcels.filter((p) => p.status !== 'delivered')

  return (
    <div className="customer">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/')}>
          <img src="/icon.svg" alt="" width={28} height={28} /> Shippy
        </button>
        <nav>
          <button className={route.name === 'orders' ? 'active' : ''} onClick={() => navigate('/orders')}>
            Orders
          </button>
          <button className={route.name === 'payment' ? 'active' : ''} onClick={() => navigate('/payment')}>
            Payments
          </button>
        </nav>
        <span className={`conn conn-${status}`} title={`Live updates: ${status}`} />
        <Inbox items={inbox} onOpenPanel={markRead} onOpenItem={(i) => i.parcel_id && openParcel(i.parcel_id)} />
      </header>

      <div className="subbar">
        <select value={userId} onChange={(e) => onUserChange(e.target.value)} aria-label="Customer">
          {config.personas.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.name}
            </option>
          ))}
        </select>
        {alerts !== 'granted' && alerts !== 'not_configured' && alerts !== 'unsupported' && (
          <button className="primary small" onClick={() => void enableAlerts(userId, true).then(setAlerts)}>
            Enable alerts
          </button>
        )}
        {alerts === 'granted' && <span className="muted small">Alerts on</span>}
        {alerts === 'denied' && <span className="muted small">Alerts blocked in browser settings</span>}
        {alerts === 'not_configured' && <span className="muted small">Push not configured</span>}
        {alerts === 'unsupported' && <span className="muted small">Push unsupported in this browser</span>}
      </div>

      <main className="content">
        {route.name === 'home' && (
          <section>
            <h2>Habari, {persona.name}</h2>
            <p className="muted">
              {onTheWay.length} parcel{onTheWay.length === 1 ? '' : 's'} on the way from{' '}
              {new Set(onTheWay.map((p) => p.store)).size} stores.
            </p>
            {needsAttention.map((p) => (
              <button key={p.parcel_id} className="attention" onClick={() => openParcel(p.parcel_id)}>
                <strong>{p.item}</strong> <StatusBadge status={p.status} />
              </button>
            ))}
            <button className="primary" onClick={() => navigate('/orders')}>
              View orders
            </button>
          </section>
        )}
        {route.name === 'orders' && <ParcelList parcels={parcels} onOpen={openParcel} />}
        {route.name === 'parcel' && (
          <ParcelTimeline parcel={parcel} flashId={flashId} onBack={() => navigate('/orders')} onPay={() => navigate('/payment')} />
        )}
        {route.name === 'payment' && (
          <section>
            <h2>Payments</h2>
            {parcels.filter((p) => p.status === 'payment_due').length === 0 && (
              <p className="muted">No delivery fees due.</p>
            )}
            {parcels
              .filter((p) => p.status === 'payment_due')
              .map((p) => (
                <div key={p.parcel_id} className="pay-card">
                  <div>
                    <strong>{p.item}</strong>
                    <span className="muted">{p.store}</span>
                  </div>
                  <button className="primary" onClick={() => recordAction('tapped:pay_fee')}>
                    Pay KES {p.fee_kes}
                  </button>
                </div>
              ))}
          </section>
        )}
      </main>

      <ToastStack toasts={toasts} onDismiss={dismiss} onOpen={(t) => {
        dismiss(t.id)
        if (t.parcelId) openParcel(t.parcelId)
      }} />
    </div>
  )
}
