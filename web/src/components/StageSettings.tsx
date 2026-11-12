import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api, getDemoKey, setDemoKey } from '@/lib/api'
import { Icon } from '@/lib/icons'
import type { AppConfig, Switches } from '@/lib/types'

interface Props {
  config: AppConfig
  onClose: () => void
  onAfterReset: () => void
  /** Registered devices were cleared; refresh the counts. */
  onDevicesCleared?: () => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{children}</h3>
}

/** Presenter settings: kill switches, demo key and housekeeping actions. */
export function StageSettings({ config, onClose, onAfterReset, onDevicesCleared }: Props) {
  const [switches, setSwitches] = useState<Switches>(config.switches)
  const [key, setKey] = useState(getDemoKey())
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      <div className="flex items-center gap-2">
        <Icon name="settings" size={18} className="text-muted-foreground" />
        <h2 className="font-semibold">Settings</h2>
        <Button variant="ghost" size="icon" className="ml-auto" aria-label="Close settings" onClick={onClose}>
          <Icon name="close" size={16} />
        </Button>
      </div>

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
            <div className="relative">
              <Input
                id="dc-key"
                type={showKey ? 'text' : 'password'}
                className="pr-9"
                autoComplete="off"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value)
                  setDemoKey(e.target.value)
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                aria-label={showKey ? 'Hide demo key' : 'Show demo key'}
                aria-pressed={showKey}
                onClick={() => setShowKey((v) => !v)}
              >
                <Icon name={showKey ? 'eyeOff' : 'eye'} size={16} />
              </Button>
            </div>
          </div>
        )}
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
        <Button
          variant="outline"
          className="border-dashed text-muted-foreground"
          disabled={busy !== null}
          title="Forget every device with alerts on. Phones that still allow alerts sign up again the next time Shippy opens."
          onClick={() =>
            run('clear devices', async () => {
              await api.clearDevices()
              onDevicesCleared?.()
            })
          }
        >
          <Icon name="bellOff" size={16} /> Clear devices
        </Button>
        {busy && <p className="text-sm text-muted-foreground">Sending {busy}…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>
    </div>
  )
}
