import { useEffect, useState } from 'react'
import { shortType, timeOf } from '../lib/format'
import { Icon, NotificationIcon } from '../lib/icons'
import type { Delivery } from '../lib/types'

const ACTION_LABEL: Record<string, string> = {
  toast: 'SSE toast',
  inline: 'Inline update',
  push: 'FCM push',
  inbox_only: 'Inbox only',
}

const SOURCE_LABEL: Record<string, string> = {
  gemini: 'Gemini',
  cache: 'Gemini (cached)',
  template: 'Template',
}

const FALLBACK_LABEL: Record<string, string> = {
  kill_switch: 'Gemini switched off',
  timeout: 'Gemini timed out',
  gemini_not_configured: 'No Gemini key',
}

function eventJson(d: Delivery): string {
  const shown = d.events.map(({ user_id: _u, ...rest }) => rest)
  return JSON.stringify(shown.length === 1 ? shown[0] : shown, null, 2)
}

export function ChannelInspector({ deliveries }: { deliveries: Delivery[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const latest = deliveries[0]
  // Follow the newest delivery unless the presenter pinned an older one.
  useEffect(() => setSelectedId(null), [latest?.id])
  const d = deliveries.find((x) => x.id === selectedId) ?? latest

  if (!d) {
    return (
      <section className="inspector empty">
        <h2>Channel Inspector</h2>
        <p className="muted">Fire an event to see raw facts → decision → words → channel.</p>
      </section>
    )
  }

  const channels = d.channels
  const session = d.session

  return (
    <section className="inspector">
      <div className="inspector-head">
        <h2>Channel Inspector</h2>
        <div className="history">
          {deliveries.slice(0, 8).map((x) => (
            <button
              key={x.id}
              className={`chip p-${x.priority} ${x.id === d.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(x.id)}
            >
              {x.kind === 'digest' ? `digest ×${x.events.length}` : shortType(x.events[0].type)}
              <small>{timeOf(x.created_at)}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="flow">
        <article className="stage-card">
          <header>
            <span className="step">1</span> Event <em>(facts, no prose)</em>
          </header>
          <pre>{eventJson(d)}</pre>
        </article>

        <div className="arrow" aria-hidden="true"><Icon name="next" size={28} /></div>

        <article className="stage-card">
          <header>
            <span className="step">2</span> Decision <em>(rules)</em>
          </header>
          <div className={`big-action a-${d.decision.action}`}>{ACTION_LABEL[d.decision.action]}</div>
          {d.decision.sticky && <div className="tag">sticky</div>}
          {d.decision.urgency === 'high' && <div className="tag">urgency: high</div>}
          <p>{d.decision.reason}</p>
          <dl className="kv">
            <dt>tabs</dt>
            <dd>{session.connection_count}</dd>
            <dt>visible</dt>
            <dd>{session.visible ? 'yes' : 'no'}</dd>
            <dt>view</dt>
            <dd>
              {session.view ?? '—'}
              {session.parcel_id ? ` · ${session.parcel_id}` : ''}
            </dd>
          </dl>
        </article>

        <div className="arrow" aria-hidden="true"><Icon name="next" size={28} /></div>

        <article className="stage-card">
          <header>
            <span className="step">3</span> Words <em>(AI or template)</em>
          </header>
          {d.message ? (
            <>
              <div className={`source s-${d.message.source}`}>
                {SOURCE_LABEL[d.message.source]}
                {d.message.latency_ms != null && d.message.source !== 'cache' && <small> {d.message.latency_ms} ms</small>}
              </div>
              {d.message.fallback_reason && (
                <p className="fallback">
                  Fallback: {FALLBACK_LABEL[d.message.fallback_reason] ?? d.message.fallback_reason}
                </p>
              )}
              <div className="preview">
                <span className="note-icon">
                  <NotificationIcon name={d.message.icon} size={28} />
                </span>
                <span className="note-text">
                  <strong>{d.message.title}</strong>
                  <span>{d.message.body}</span>
                </span>
              </div>
              <p className="muted small">icon: {d.message.icon}</p>
              <p className="muted small">
                context: {d.context.view}, {d.context.visible ? 'visible' : 'away'}, {d.context.locale}
              </p>
            </>
          ) : (
            <p className="silence">No words needed. Rules chose not to speak.</p>
          )}
        </article>

        <div className="arrow" aria-hidden="true"><Icon name="next" size={28} /></div>

        <article className="stage-card">
          <header>
            <span className="step">4</span> Channel
          </header>
          <ul className="channels">
            {channels.map((c) => (
              <li key={c.channel} className={`ch ch-${c.channel} st-${c.status}`}>
                <strong>{c.channel.toUpperCase()}</strong>
                <span>{c.status.replace(/_/g, ' ')}</span>
                {c.detail && <small>{c.detail}</small>}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}
