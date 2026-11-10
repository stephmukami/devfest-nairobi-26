import { useCallback, useEffect, useState } from 'react'
import { ChannelInspector } from '@/components/ChannelInspector'
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
    // Desktop: full-height sidebar + scrolling main. Below 1024px the sidebar stacks on top.
    <div className="min-h-dvh lg:grid lg:h-dvh lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border-b bg-card lg:overflow-y-auto lg:border-r lg:border-b-0">
        <DemoController
          config={config}
          userId={userId}
          onUserChange={onUserChange}
          parcels={parcels}
          presence={presence}
          onAfterReset={load}
        />
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:overflow-y-auto">
        <header className="mx-auto mb-6 flex max-w-5xl flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Signals over noise</h1>
            <p className="text-muted-foreground">Events carry facts. Rules decide who hears. AI decides the words.</p>
          </div>
          <Button variant="outline" asChild className="ml-auto">
            <a href="/" target="_blank" rel="noreferrer">
              Open customer app <Icon name="external" size={16} />
            </a>
          </Button>
        </header>
        <div className="mx-auto max-w-5xl">
          <ChannelInspector deliveries={deliveries} status={status} />
        </div>
      </main>
    </div>
  )
}
