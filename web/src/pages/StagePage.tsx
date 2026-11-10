import { useCallback, useEffect, useState } from 'react'
import { ChannelInspector } from '@/components/ChannelInspector'
import { ConnDot } from '@/components/ConnDot'
import { DemoController } from '@/components/DemoController'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { Icon } from '@/lib/icons'
import { useStream } from '@/lib/sse'
import { tabClientId } from '@/lib/storage'
import type { AppConfig, Delivery, Parcel, Presence } from '@/lib/types'

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
    <div className="min-h-screen px-5 py-4 text-[1.05rem]">
      <header className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold">
          <img src="/icon.svg" alt="" width={32} height={32} /> Signals over noise
        </h1>
        <span className="text-muted-foreground">Events carry facts. Rules decide who hears. AI decides the words.</span>
        <ConnDot status={status} label="Inspector stream" />
        <Button variant="link" asChild className="ml-auto font-semibold">
          <a href="/" target="_blank" rel="noreferrer">
            Open customer app <Icon name="external" size={16} />
          </a>
        </Button>
      </header>
      <div className="grid items-start gap-5 min-[800px]:grid-cols-[300px_1fr]">
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
