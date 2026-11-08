import { useCallback, useEffect, useState } from 'react'
import { ChannelInspector } from '../components/ChannelInspector'
import { DemoController } from '../components/DemoController'
import { api } from '../lib/api'
import { useStream } from '../lib/sse'
import { tabClientId } from '../lib/storage'
import type { AppConfig, Delivery, Parcel, Presence } from '../lib/types'

interface Props {
  config: AppConfig
  userId: string
  onUserChange: (userId: string) => void
}

const clientId = tabClientId()

/** Presenter view. Observes the stream without counting as the customer's presence,
 *  so hiding the customer tab (or locking the phone) still shows here. */
export function StagePage({ config, userId, onUserChange }: Props) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [presence, setPresence] = useState<Presence | null>(null)
  const [parcels, setParcels] = useState<Parcel[]>([])

  const load = useCallback(() => {
    api.deliveries(userId).then((ds) => setDeliveries([...ds].reverse())).catch(() => setDeliveries([]))
    api.parcels(userId).then(setParcels).catch(() => {})
    api.presence(userId).then(setPresence).catch(() => {})
  }, [userId])

  useEffect(load, [load])

  const onDelivery = useCallback((d: Delivery) => {
    setDeliveries((ds) => [d, ...ds.filter((x) => x.id !== d.id)].slice(0, 50))
    if (d.parcels.length) setParcels((ps) => ps.map((p) => d.parcels.find((u) => u.parcel_id === p.parcel_id) ?? p))
  }, [])

  const status = useStream({ userId, clientId, observer: true, onDelivery, onPresence: setPresence })

  return (
    <div className="stage">
      <header className="stage-top">
        <h1>
          <img src="/icon.svg" alt="" width={32} height={32} /> Signals over noise
        </h1>
        <span className="muted">
          Events carry facts. Rules decide who hears. AI decides the words.
        </span>
        <span className={`conn conn-${status}`} title={`Inspector stream: ${status}`} />
        <a href="/" target="_blank" rel="noreferrer" className="link">
          Open customer app ↗
        </a>
      </header>
      <div className="stage-body">
        <DemoController
          config={config}
          userId={userId}
          onUserChange={onUserChange}
          parcels={parcels}
          presence={presence}
          onAfterReset={load}
        />
        <ChannelInspector deliveries={deliveries} />
      </div>
    </div>
  )
}
