import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { api, getDemoKey, setDemoKey } from '@/lib/api'
import { PRIORITY_BORDER_L, PRIORITY_TEXT } from '@/lib/priority'
import type { AppConfig, Parcel, Presence, Switches } from '@/lib/types'
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

function GroupLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={cn('mt-1 text-[0.72rem] tracking-widest text-muted-foreground uppercase', className)}>{children}</h3>
}

const emitButton = 'h-auto w-full justify-start border-l-4 py-1.5 font-mono text-xs whitespace-normal'

export function DemoController({ config, userId, onUserChange, parcels, presence, onAfterReset }: Props) {
  const [parcelId, setParcelId] = useState('')
  const [switches, setSwitches] = useState<Switches>(config.switches)
  const [key, setKey] = useState(getDemoKey())
  const [busy, setBusy] = useState<string | null>(null)
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

  const byPriority = (['info', 'action', 'critical'] as const).map((priority) => ({
    priority,
    types: config.catalogue.filter((c) => c.priority === priority),
  }))

  const switchRows: { id: string; checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }[] = [
    {
      id: 'sw-gemini',
      checked: switches.enrich_mode === 'gemini',
      onChange: (v) => toggle({ enrich_mode: v ? 'gemini' : 'template' }),
      label: (
        <>
          Gemini enrichment{' '}
          {!config.gemini_configured && <em className="font-normal text-muted-foreground">(no API key, templates only)</em>}
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
    <Card className="min-[800px]:sticky min-[800px]:top-4">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Demo controller</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="dc-customer" className="text-muted-foreground">
            Customer
          </Label>
          <Select value={userId} onValueChange={onUserChange}>
            <SelectTrigger id="dc-customer" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config.personas.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.name} ({p.locale})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className={cn('size-2 rounded-full', presence?.session.visible ? 'bg-good' : 'bg-muted-foreground')} />
          {describeSession(presence)}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="dc-parcel" className="text-muted-foreground">
            Parcel
          </Label>
          <Select value={parcelId} onValueChange={setParcelId}>
            <SelectTrigger id="dc-parcel" className="w-full">
              <SelectValue placeholder="No parcels" />
            </SelectTrigger>
            <SelectContent>
              {parcels.map((p) => (
                <SelectItem key={p.parcel_id} value={p.parcel_id}>
                  {p.parcel_id} · {p.item} ({p.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {byPriority.map(({ priority, types }) => (
          <div key={priority} className="grid gap-1.5">
            <GroupLabel className={PRIORITY_TEXT[priority]}>{priority}</GroupLabel>
            {types.map((t) => (
              <Button
                key={t.type}
                variant="outline"
                className={cn(emitButton, PRIORITY_BORDER_L[priority])}
                title={t.meaning}
                disabled={busy !== null}
                onClick={() => run(t.type, () => api.emit(userId, t.type, parcelId || undefined))}
              >
                {t.type}
              </Button>
            ))}
          </div>
        ))}

        <div className="grid gap-1.5">
          <GroupLabel>scenario</GroupLabel>
          <Button
            variant="outline"
            className={cn(emitButton, 'border-l-muted-foreground')}
            disabled={busy !== null}
            onClick={() => run('burst', () => api.burst(userId))}
          >
            Burst: 3 events at once
          </Button>
        </div>

        <Separator />
        <GroupLabel>Kill switches</GroupLabel>
        {switchRows.map((s) => (
          <div key={s.id} className="flex items-center gap-2.5">
            <Switch id={s.id} checked={s.checked} onCheckedChange={s.onChange} />
            <Label htmlFor={s.id} className="font-normal">
              {s.label}
            </Label>
          </div>
        ))}

        <Button
          variant="outline"
          className="border-dashed text-muted-foreground"
          disabled={busy !== null}
          onClick={() =>
            run('reset', async () => {
              await api.reset()
              onAfterReset()
            })
          }
        >
          Reset demo data
        </Button>

        {config.demo_key_required && (
          <div className="grid gap-1.5">
            <Label htmlFor="dc-key" className="text-muted-foreground">
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

        {busy && <p className="text-sm text-muted-foreground">Sending {busy}…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
