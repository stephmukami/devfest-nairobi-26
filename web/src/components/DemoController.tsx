import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { api, getDemoKey, setDemoKey } from '@/lib/api'
import { eventLabel, STATUS_LABEL } from '@/lib/format'
import { Icon } from '@/lib/icons'
import { PRIORITY_TEXT } from '@/lib/priority'
import type { AppConfig, Parcel, Presence, Priority, Switches } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  config: AppConfig
  userId: string
  onUserChange: (userId: string) => void
  parcels: Parcel[]
  presence: Presence | null
  onAfterReset: () => void
}

function describeSession(p: Presence | null): string {
  if (!p) return 'unknown'
  const s = p.session
  if (s.connection_count === 0) return 'No customer tab open'
  const tabs = `${s.connection_count} tab${s.connection_count > 1 ? 's' : ''}`
  if (!s.visible) return `${tabs} · hidden`
  return `${tabs} · visible · ${s.view}${s.parcel_id ? ` ${s.parcel_id}` : ''}`
}

const GROUPS: { priority: Priority; title: string }[] = [
  { priority: 'info', title: 'Trigger info events' },
  { priority: 'action', title: 'Action required' },
  { priority: 'critical', title: 'Critical scenarios' },
]

// The last fired event stays highlighted in its priority colour.
const FIRED_BG: Record<Priority, string> = {
  info: 'bg-info/10',
  action: 'bg-action/10',
  critical: 'bg-critical/10',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h3>
}

const triggerRow =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:cursor-progress disabled:opacity-60'

export function DemoController({ config, userId, onUserChange, parcels, presence, onAfterReset }: Props) {
  const [parcelId, setParcelId] = useState('')
  const [switches, setSwitches] = useState<Switches>(config.switches)
  const [key, setKey] = useState(getDemoKey())
  const [busy, setBusy] = useState<string | null>(null)
  const [fired, setFired] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!parcels.some((p) => p.parcel_id === parcelId)) setParcelId(parcels[0]?.parcel_id ?? '')
  }, [parcels, parcelId])

  useEffect(() => {
    api.getSettings().then(setSwitches).catch(() => {})
  }, [key])

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const toggle = (update: Partial<Switches>) => run('settings', async () => setSwitches(await api.putSettings(update)))

  const persona = config.personas.find((p) => p.user_id === userId)
  const parcel = parcels.find((p) => p.parcel_id === parcelId)

  const switchRows: { id: string; checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }[] = [
    {
      id: 'sw-gemini',
      checked: switches.enrich_mode === 'gemini',
      onChange: (v) => toggle({ enrich_mode: v ? 'gemini' : 'template' }),
      label: (
        <>
          Gemini enrichment
          {!config.gemini_configured && <em className="block font-normal text-muted-foreground">No API key, templates only</em>}
        </>
      ),
    },
    {
      id: 'sw-outage',
      checked: switches.simulate_gemini_failure,
      onChange: (v) => toggle({ simulate_gemini_failure: v }),
      label: 'Simulate Gemini outage',
    },
    {
      id: 'sw-coalesce',
      checked: switches.coalesce,
      onChange: (v) => toggle({ coalesce: v }),
      label: 'Coalesce bursts (2 s window)',
    },
  ]

  return (
    <div className="grid gap-6 p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Icon name="truck" size={22} />
        </span>
        <span className="text-xl font-extrabold tracking-tight">SHIPPY</span>
        <Badge variant="secondary" className="ml-auto rounded-md font-mono text-[0.65rem] tracking-wider">
          STAGE
        </Badge>
      </div>

      <section>
        <SectionLabel>Customer context</SectionLabel>
        <Select value={userId} onValueChange={onUserChange}>
          <SelectTrigger className="w-full rounded-lg bg-muted/50 py-2.5 data-[size=default]:h-auto" aria-label="Customer">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 flex-none place-items-center rounded-full bg-action/15 text-sm font-bold text-action">
                {persona?.name.charAt(0)}
              </span>
              <span className="truncate text-left font-semibold">{persona?.name}</span>
            </span>
          </SelectTrigger>
          {/* popper: drop down under the custom trigger. The default "item-aligned" mode needs a SelectValue to line up with and pushes the list off-screen without one. */}
          <SelectContent position="popper" className="w-(--radix-select-trigger-width)">
            {config.personas.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <span className={cn('size-2 rounded-full', presence?.session.visible ? 'bg-good' : 'bg-muted-foreground')} />
          {describeSession(presence)}
        </p>
      </section>

      <section>
        <SectionLabel>Parcel context</SectionLabel>
        <Select value={parcelId} onValueChange={setParcelId} disabled={parcels.length === 0}>
          <SelectTrigger className="w-full rounded-lg bg-muted/50 py-2.5 data-[size=default]:h-auto" aria-label="Parcel">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 flex-none place-items-center text-primary">
                <Icon name="package" size={22} />
              </span>
              <span className="grid min-w-0 text-left">
                <span className="truncate font-semibold">{parcel?.parcel_id ?? 'No parcels'}</span>
                {parcel && (
                  <span className="truncate text-xs text-primary">
                    {parcel.item} · {STATUS_LABEL[parcel.status] ?? parcel.status}
                  </span>
                )}
              </span>
            </span>
          </SelectTrigger>
          <SelectContent position="popper" className="w-(--radix-select-trigger-width)">
            {parcels.map((p) => (
              <SelectItem key={p.parcel_id} value={p.parcel_id}>
                {p.parcel_id} · {p.item} ({STATUS_LABEL[p.status] ?? p.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {GROUPS.map(({ priority, title }) => (
        <section key={priority}>
          <SectionLabel>{title}</SectionLabel>
          <ul className="grid gap-0.5">
            {config.catalogue
              .filter((c) => c.priority === priority)
              .map((t) => (
                <li key={t.type}>
                  <button
                    className={cn(triggerRow, fired === t.type && [FIRED_BG[priority], PRIORITY_TEXT[priority]])}
                    title={`${t.type}: ${t.meaning}`}
                    disabled={busy !== null}
                    onClick={() =>
                      run(t.type, async () => {
                        await api.emit(userId, t.type, parcelId || undefined)
                        setFired(t.type)
                      })
                    }
                  >
                    <Icon name={priority} size={16} className={PRIORITY_TEXT[priority]} />
                    {eventLabel(t.type)}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section>
        <SectionLabel>Scenarios</SectionLabel>
        <button
          className={cn(triggerRow, fired === 'burst' && 'bg-muted')}
          disabled={busy !== null}
          onClick={() =>
            run('burst', async () => {
              await api.burst(userId)
              setFired('burst')
            })
          }
        >
          <Icon name="flash" size={16} className="text-primary" />
          Burst: 3 events at once
        </button>
      </section>

      <section className="grid gap-3">
        <SectionLabel>Kill switches</SectionLabel>
        {switchRows.map((s) => (
          <div key={s.id} className="flex items-start gap-2.5">
            <Switch id={s.id} checked={s.checked} onCheckedChange={s.onChange} className="mt-0.5" />
            <Label htmlFor={s.id} className="block font-normal">
              {s.label}
            </Label>
          </div>
        ))}
      </section>

      <section className="grid gap-3">
        {config.demo_key_required && (
          <div className="grid gap-1.5">
            <Label htmlFor="dc-key" className="text-xs text-muted-foreground">
              Demo key
            </Label>
            <Input
              id="dc-key"
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                setDemoKey(e.target.value)
              }}
            />
          </div>
        )}
        <Button
          variant="outline"
          className="border-dashed text-muted-foreground"
          disabled={busy !== null}
          onClick={() =>
            run('reset', async () => {
              await api.reset()
              setFired(null)
              onAfterReset()
            })
          }
        >
          Reset demo data
        </Button>
        {busy && <p className="text-sm text-muted-foreground">Sending {busy}…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>
    </div>
  )
}
