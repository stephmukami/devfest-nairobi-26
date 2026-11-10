import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { shortType, timeOf } from '@/lib/format'
import { Icon } from '@/lib/icons'
import { PRIORITY_BORDER_B } from '@/lib/priority'
import type { Delivery } from '@/lib/types'
import { cn } from '@/lib/utils'
import { NoteIcon } from './NoteIcon'

const ACTION_LABEL: Record<string, string> = {
  toast: 'SSE toast',
  inline: 'Inline update',
  push: 'FCM push',
  inbox_only: 'Inbox only',
}

const ACTION_TEXT: Record<string, string> = {
  toast: 'text-info',
  inline: 'text-good',
  push: 'text-action',
  inbox_only: 'text-muted-foreground',
}

const SOURCE_LABEL: Record<string, string> = {
  gemini: 'Gemini',
  cache: 'Gemini (cached)',
  template: 'Template',
}

const SOURCE_TEXT: Record<string, string> = {
  gemini: 'text-primary',
  cache: 'text-primary',
  template: 'text-action',
}

const FALLBACK_LABEL: Record<string, string> = {
  kill_switch: 'Gemini switched off',
  timeout: 'Gemini timed out',
  gemini_not_configured: 'No Gemini key',
}

const CHANNEL_BORDER: Record<string, string> = {
  sse: 'border-l-info',
  fcm: 'border-l-action',
  inline: 'border-l-good',
}

const FAILED_STATUSES = new Set(['error', 'no_tokens', 'disabled'])

function eventJson(d: Delivery): string {
  const shown = d.events.map(({ user_id: _u, ...rest }) => rest)
  return JSON.stringify(shown.length === 1 ? shown[0] : shown, null, 2)
}

function StepCard({ n, title, note, children }: { n: number; title: string; note?: string; children: React.ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-bold">
          <span className="grid size-6.5 place-items-center rounded-full bg-primary text-sm text-primary-foreground">{n}</span>
          {title}
          {note && <em className="text-sm font-normal text-muted-foreground">{note}</em>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5 text-base">{children}</CardContent>
    </Card>
  )
}

function Arrow() {
  return (
    <div className="hidden place-items-center text-muted-foreground min-[1200px]:grid" aria-hidden="true">
      <Icon name="next" size={28} />
    </div>
  )
}

export function ChannelInspector({ deliveries }: { deliveries: Delivery[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const latest = deliveries[0]
  // Follow the newest delivery unless the presenter pinned an older one.
  useEffect(() => setSelectedId(null), [latest?.id])
  const d = deliveries.find((x) => x.id === selectedId) ?? latest

  if (!d) {
    return (
      <Card className="min-w-0 p-8">
        <h2 className="text-2xl font-bold">Channel Inspector</h2>
        <p className="text-muted-foreground">Fire an event to see raw facts → decision → words → channel.</p>
      </Card>
    )
  }

  const session = d.session

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-bold">Channel Inspector</h2>
        <div className="flex flex-wrap gap-1.5">
          {deliveries.slice(0, 8).map((x) => (
            <Button
              key={x.id}
              variant="outline"
              className={cn(
                'h-auto flex-col items-start gap-0 border-b-[3px] px-2.5 py-1',
                PRIORITY_BORDER_B[x.priority],
                x.id === d.id && 'ring-2 ring-primary',
              )}
              onClick={() => setSelectedId(x.id)}
            >
              {x.kind === 'digest' ? `digest ×${x.events.length}` : shortType(x.events[0].type)}
              <small className="text-[0.7rem] font-normal text-muted-foreground">{timeOf(x.created_at)}</small>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-2 min-[800px]:grid-cols-2 min-[1200px]:grid-cols-[minmax(0,1.15fr)_auto_minmax(0,1fr)_auto_minmax(0,1.1fr)_auto_minmax(0,0.9fr)]">
        <StepCard n={1} title="Event" note="(facts, no prose)">
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted p-3 text-sm break-words whitespace-pre-wrap">
            {eventJson(d)}
          </pre>
        </StepCard>

        <Arrow />

        <StepCard n={2} title="Decision" note="(rules)">
          <div className={cn('text-3xl font-extrabold', ACTION_TEXT[d.decision.action])}>{ACTION_LABEL[d.decision.action]}</div>
          {(d.decision.sticky || d.decision.urgency === 'high') && (
            <div className="flex gap-1.5">
              {d.decision.sticky && <Badge variant="secondary">sticky</Badge>}
              {d.decision.urgency === 'high' && <Badge variant="secondary">urgency: high</Badge>}
            </div>
          )}
          <p>{d.decision.reason}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
            <dt className="text-muted-foreground">tabs</dt>
            <dd className="font-semibold">{session.connection_count}</dd>
            <dt className="text-muted-foreground">visible</dt>
            <dd className="font-semibold">{session.visible ? 'yes' : 'no'}</dd>
            <dt className="text-muted-foreground">view</dt>
            <dd className="font-semibold">
              {session.view ?? '—'}
              {session.parcel_id ? ` · ${session.parcel_id}` : ''}
            </dd>
          </dl>
        </StepCard>

        <Arrow />

        <StepCard n={3} title="Words" note="(AI or template)">
          {d.message ? (
            <>
              <div className={cn('text-xl font-extrabold', SOURCE_TEXT[d.message.source])}>
                {SOURCE_LABEL[d.message.source]}
                {d.message.latency_ms != null && d.message.source !== 'cache' && (
                  <small className="ml-1 text-sm font-medium text-muted-foreground">{d.message.latency_ms} ms</small>
                )}
              </div>
              {d.message.fallback_reason && (
                <p className="font-semibold text-action">
                  Fallback: {FALLBACK_LABEL[d.message.fallback_reason] ?? d.message.fallback_reason}
                </p>
              )}
              <div className="flex items-start gap-3 rounded-lg border-l-4 border-l-primary bg-muted p-3 text-lg">
                <NoteIcon name={d.message.icon} size="lg" />
                <span className="grid min-w-0 gap-0.5">
                  <strong className="text-xl">{d.message.title}</strong>
                  <span>{d.message.body}</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground">icon: {d.message.icon}</p>
              <p className="text-sm text-muted-foreground">
                context: {d.context.view}, {d.context.visible ? 'visible' : 'away'}, {d.context.locale}
              </p>
            </>
          ) : (
            <p className="text-xl font-bold text-good">No words needed. Rules chose not to speak.</p>
          )}
        </StepCard>

        <Arrow />

        <StepCard n={4} title="Channel">
          <ul className="grid gap-2">
            {d.channels.map((c) => (
              <li
                key={c.channel}
                className={cn(
                  'grid rounded-lg border-l-4 border-l-muted-foreground bg-muted px-3 py-2.5',
                  CHANNEL_BORDER[c.channel],
                  FAILED_STATUSES.has(c.status) && 'border-dashed',
                )}
              >
                <strong className="text-xl">{c.channel.toUpperCase()}</strong>
                <span>{c.status.replace(/_/g, ' ')}</span>
                {c.detail && <small className="text-muted-foreground">{c.detail}</small>}
              </li>
            ))}
          </ul>
        </StepCard>
      </div>
    </section>
  )
}
