import { useEffect, useState } from 'react'
import { api, getDemoKey, setDemoKey } from '../lib/api'
import type { AppConfig, Parcel, Presence, Switches } from '../lib/types'

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

  return (
    <aside className="controller">
      <h2>Demo controller</h2>

      <label className="field">
        <span>Customer</span>
        <select value={userId} onChange={(e) => onUserChange(e.target.value)}>
          {config.personas.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.name} ({p.locale})
            </option>
          ))}
        </select>
      </label>

      <div className={`session-pill ${presence?.session.visible ? 'on' : ''}`}>
        <span className="dot" /> {describeSession(presence)}
      </div>

      <label className="field">
        <span>Parcel</span>
        <select value={parcelId} onChange={(e) => setParcelId(e.target.value)}>
          {parcels.map((p) => (
            <option key={p.parcel_id} value={p.parcel_id}>
              {p.parcel_id} · {p.item} ({p.status})
            </option>
          ))}
        </select>
      </label>

      {byPriority.map(({ priority, types }) => (
        <div key={priority} className="emit-group">
          <h3 className={`p-label p-${priority}`}>{priority}</h3>
          <div className="emit-buttons">
            {types.map((t) => (
              <button
                key={t.type}
                className={`emit p-${priority}`}
                title={t.meaning}
                disabled={busy !== null}
                onClick={() => run(t.type, () => api.emit(userId, t.type, parcelId || undefined))}
              >
                {t.type}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="emit-group">
        <h3 className="p-label">scenario</h3>
        <button className="emit" disabled={busy !== null} onClick={() => run('burst', () => api.burst(userId))}>
          Burst: 3 events at once
        </button>
      </div>

      <h3 className="p-label">Kill switches</h3>
      <label className="switch">
        <input
          type="checkbox"
          checked={switches.enrich_mode === 'gemini'}
          onChange={(e) => toggle({ enrich_mode: e.target.checked ? 'gemini' : 'template' })}
        />
        <span>
          Gemini enrichment{' '}
          {!config.gemini_configured && <em className="muted">(no API key, templates only)</em>}
        </span>
      </label>
      <label className="switch">
        <input
          type="checkbox"
          checked={switches.simulate_gemini_failure}
          onChange={(e) => toggle({ simulate_gemini_failure: e.target.checked })}
        />
        <span>Simulate Gemini outage</span>
      </label>
      <label className="switch">
        <input type="checkbox" checked={switches.coalesce} onChange={(e) => toggle({ coalesce: e.target.checked })} />
        <span>Coalesce bursts (2 s window)</span>
      </label>

      <button className="reset" disabled={busy !== null} onClick={() => run('reset', async () => {
        await api.reset()
        onAfterReset()
      })}>
        Reset demo data
      </button>

      {config.demo_key_required && (
        <label className="field">
          <span>Demo key</span>
          <input
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value)
              setDemoKey(e.target.value)
            }}
          />
        </label>
      )}

      {busy && <p className="muted">Sending {busy}…</p>}
      {error && <p className="error">{error}</p>}
    </aside>
  )
}
