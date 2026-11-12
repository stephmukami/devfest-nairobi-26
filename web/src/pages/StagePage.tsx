import { useCallback, useEffect, useState } from 'react'
import { ChannelInspector } from '@/components/ChannelInspector'
import { DemoController } from '@/components/DemoController'
import { StageSettings } from '@/components/StageSettings'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { Icon } from '@/lib/icons'
import { useStream } from '@/lib/sse'
import { tabClientId } from '@/lib/storage'
import type { AppConfig, Delivery, Parcel, Presence } from '@/lib/types'
import { cn } from '@/lib/utils'

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
  // Label of an event fired from the controller whose delivery has not arrived yet.
  const [pending, setPending] = useState<string | null>(null)

  // A pending event belongs to the previous customer's stream, which we stop watching.
  useEffect(() => setPending(null), [userId])

  // Safety net: never leave the inspector in its loading state if a delivery never comes.
  useEffect(() => {
    if (!pending) return
    const timer = window.setTimeout(() => setPending(null), 15_000)
    return () => window.clearTimeout(timer)
  }, [pending])

  const load = useCallback(() => {
    api.deliveries(userId).then((ds) => setDeliveries([...ds].reverse())).catch(() => setDeliveries([]))
    api.parcels(userId).then(setParcels).catch(() => {})
    api.presence(userId).then(setPresence).catch(() => {})
  }, [userId])

  useEffect(load, [load])

  const onDelivery = useCallback((d: Delivery) => {
    setPending(null)
    setDeliveries((ds) => [d, ...ds.filter((x) => x.id !== d.id)].slice(0, 50))
    if (d.parcels.length) setParcels((ps) => ps.map((p) => d.parcels.find((u) => u.parcel_id === p.parcel_id) ?? p))
  }, [])

  const status = useStream({ userId, clientId, observer: true, onDelivery, onPresence: setPresence })

  // Which persona each phone receives pushes for. Registration follows a tab connecting (a presence
  // update), so refresh shortly after each one, plus a slow poll for tabs of other personas.
  const [devices, setDevices] = useState<Record<string, number> | null>(null)
  const loadDevices = useCallback(() => {
    api.devices().then(setDevices).catch(() => {})
  }, [])
  useEffect(() => {
    loadDevices()
    const poll = window.setInterval(loadDevices, 10_000)
    return () => window.clearInterval(poll)
  }, [loadDevices])
  useEffect(() => {
    const t = window.setTimeout(loadDevices, 1_500)
    return () => window.clearTimeout(t)
  }, [presence, userId, loadDevices])

  const [controlsOpen, setControlsOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [resetCount, setResetCount] = useState(0)

  return (
    // Desktop: full-height sidebars + scrolling main. Below 1024px the controls stack on top
    // and settings slide over from the right. Hidden panels stay mounted to keep their state.
    <div className="min-h-dvh lg:flex lg:h-dvh">
      <aside
        className={cn(
          'border-b bg-card lg:w-[300px] lg:flex-none lg:overflow-y-auto lg:border-r lg:border-b-0',
          !controlsOpen && 'hidden',
        )}
      >
        <DemoController
          config={config}
          userId={userId}
          onUserChange={onUserChange}
          parcels={parcels}
          presence={presence}
          devices={devices}
          resetCount={resetCount}
          onFire={setPending}
          onFireFailed={() => setPending(null)}
        />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:overflow-y-auto">
        <header className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={controlsOpen ? 'Hide controls' : 'Show controls'}
            aria-pressed={controlsOpen}
            title={controlsOpen ? 'Hide controls' : 'Show controls'}
            onClick={() => setControlsOpen((v) => !v)}
          >
            <Icon name="sidebar" size={20} />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Signals over Noise</h1>
          <Button variant="outline" asChild className="ml-auto">
            <a href="/" target="_blank" rel="noreferrer">
              Open customer app <Icon name="external" size={16} />
            </a>
          </Button>
          <Button
            variant={settingsOpen ? 'secondary' : 'outline'}
            size="icon-lg"
            aria-label={settingsOpen ? 'Hide settings' : 'Show settings'}
            aria-pressed={settingsOpen}
            title="Settings"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <Icon name="settings" size={18} />
          </Button>
        </header>
        <div className="mx-auto max-w-5xl">
          <ChannelInspector deliveries={deliveries} status={status} pending={pending} />
        </div>
      </main>
      {settingsOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" aria-hidden="true" onClick={() => setSettingsOpen(false)} />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-40 w-[300px] max-w-[85vw] overflow-y-auto border-l bg-card shadow-xl',
          'lg:static lg:z-auto lg:max-w-none lg:flex-none lg:shadow-none',
          !settingsOpen && 'hidden',
        )}
      >
        <StageSettings
          config={config}
          onClose={() => setSettingsOpen(false)}
          onAfterReset={() => {
            setResetCount((n) => n + 1)
            load()
          }}
          onDevicesCleared={loadDevices}
        />
      </aside>
    </div>
  )
}
