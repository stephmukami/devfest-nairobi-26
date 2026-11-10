import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { shortType, timeOf } from '@/lib/format'
import { Icon } from '@/lib/icons'
import { PRIORITY_TEXT } from '@/lib/priority'
import type { StreamStatus } from '@/lib/sse'
import type { Delivery, Priority } from '@/lib/types'
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
  cache: 'Gemini, cached',
  template: 'Template',
}

const FALLBACK_LABEL: Record<string, string> = {
  kill_switch: 'Gemini switched off',
  timeout: 'Gemini timed out',
  gemini_not_configured: 'No Gemini key',
}

const CHANNEL_LABEL: Record<string, string> = {
  sse: 'SSE stream',
  fcm: 'FCM push',
  inbox: 'Inbox',
  inline: 'Inline update',
}

const FAILED_STATUSES = new Set(['error', 'no_tokens', 'disabled'])

function eventJson(d: Delivery): string {
  const shown = d.events.map(({ user_id: _u, ...rest }) => rest)
  return JSON.stringify(shown.length === 1 ? shown[0] : shown, null, 2)
}

type Tone = 'info' | 'action' | 'primary' | 'good'

const STEP_ICON: Record<Tone, string> = {
  info: 'text-info',
  action: 'text-action',
  primary: 'text-primary',
  good: 'text-good',
}

function Step({
  n,
  tone,
  icon,
  title,
  last,
  children,
}: {
  n: number
  tone: Tone
  icon: 'code' | 'scale' | 'chat' | 'send'
  title: string
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 pb-8 last:pb-0 sm:gap-6">
      {!last && <span className="absolute top-12 bottom-2 left-5 w-px bg-border" aria-hidden="true" />}
      <span
        className="relative mt-3 grid size-10 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground ring-4 ring-card"
      >
        {n}
      </span>
      <section className="min-w-0 rounded-2xl border bg-muted/50 p-4 sm:p-5">
        <h3 className="mb-3.5 flex items-center gap-2 text-sm font-bold tracking-widest text-muted-foreground uppercase">
          <Icon name={icon} size={18} className={STEP_ICON[tone]} />
          {title}
        </h3>
        {children}
      </section>
    </li>
  )
}

/** White box inside a step. */
function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-xl border bg-card p-3.5', className)}>{children}</div>
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Panel className="flex items-center justify-between gap-3 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-bold uppercase', tone)}>{value}</span>
    </Panel>
  )
}

function Header({ status, deliveryId }: { status: StreamStatus; deliveryId?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-6 py-5">
      <h2 className="flex items-center gap-2.5 text-lg font-bold">
        <Icon name="pipeline" size={22} /> Channel Inspector
      </h2>
      <div className="ml-auto flex items-center gap-2">
        <Badge
          className={cn(
            'rounded-md px-2.5 py-1 text-[0.7rem] font-bold uppercase',
            status === 'open' ? 'bg-primary/15 text-primary' : 'bg-action/15 text-action',
          )}
        >
          {status === 'open' ? 'Live pipeline' : status === 'connecting' ? 'Connecting' : 'Offline'}
        </Badge>
        {deliveryId && (
          <Badge variant="secondary" className="rounded-md px-2.5 py-1 font-mono text-[0.7rem]">
            ID: {deliveryId}
          </Badge>
        )}
      </div>
    </div>
  )
}

interface RecentGroup {
  key: string
  label: string
  priority: Priority
  latest: Delivery
  count: number
  ids: Set<string>
}

/** One card per event type (digests together), newest first, with how many times it fired. */
function groupRecent(deliveries: Delivery[]): RecentGroup[] {
  const groups = new Map<string, RecentGroup>()
  for (const x of deliveries) {
    const key = x.kind === 'digest' ? 'digest' : x.events[0].type
    const g = groups.get(key)
    if (g) {
      g.count += 1
      g.ids.add(x.id)
    } else {
      groups.set(key, {
        key,
        label: key === 'digest' ? 'digest' : shortType(key),
        priority: x.priority,
        latest: x,
        count: 1,
        ids: new Set([x.id]),
      })
    }
  }
  return [...groups.values()]
}

export function ChannelInspector({ deliveries, status }: { deliveries: Delivery[]; status: StreamStatus }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const latest = deliveries[0]
  // Follow the newest delivery unless the presenter pinned an older one.
  useEffect(() => setSelectedId(null), [latest?.id])
  const d = deliveries.find((x) => x.id === selectedId) ?? latest

  if (!d) {
    return (
      <Card className="min-w-0 gap-0 rounded-3xl py-0">
        <Header status={status} />
        <p className="px-6 py-10 text-muted-foreground">
          Fire an event to follow it through the pipeline: raw facts, decision, words, channel.
        </p>
      </Card>
    )
  }

  const session = d.session
  const where = session.connection_count === 0 ? 'No tab' : session.visible ? 'Visible' : 'Hidden'

  return (
    <Card className="min-w-0 gap-0 rounded-3xl py-0">
      <Header status={status} deliveryId={d.id} />

      {deliveries.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3">
          <span className="mr-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Recent</span>
          {groupRecent(deliveries).slice(0, 8).map((g) => (
            <button
              key={g.key}
              className={cn(
                'flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-left text-sm shadow-sm transition-shadow hover:shadow-md',
                g.ids.has(d.id) && 'ring-2 ring-primary',
              )}
              onClick={() => setSelectedId(g.latest.id)}
            >
              <Icon name={g.priority} size={16} className={PRIORITY_TEXT[g.priority]} />
              <span className="sr-only">{g.priority} priority:</span>
              <span className="grid leading-tight">
                <span className="font-medium">{g.label}</span>
                <small className="text-[0.7rem] text-muted-foreground">{timeOf(g.latest.created_at)}</small>
              </span>
              {g.count > 1 && (
                <Badge variant="secondary" className="rounded-full px-1.5 tabular-nums" aria-label={`fired ${g.count} times`}>
                  ×{g.count}
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}

      <ol className="px-4 py-6 sm:px-6">
        <Step n={1} tone="info" icon="code" title="Event facts">
          <Panel>
            <pre className="max-h-[50vh] overflow-auto font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">
              {eventJson(d)}
            </pre>
          </Panel>
        </Step>

        <Step n={2} tone="action" icon="scale" title="Decision logic">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Stat label="Channel" value={ACTION_LABEL[d.decision.action]} tone={ACTION_TEXT[d.decision.action]} />
            <Stat
              label="Inbox placement"
              value={d.decision.also_inbox ? 'Yes' : 'No'}
              tone={d.decision.also_inbox ? 'text-good' : 'text-muted-foreground'}
            />
            <Stat
              label="Urgency"
              value={d.decision.sticky ? 'Critical' : d.decision.urgency}
              tone={d.decision.sticky || d.decision.urgency === 'high' ? 'text-critical' : 'text-muted-foreground'}
            />
            <Stat
              label="Customer tab"
              value={session.view && session.visible ? `${where} · ${session.view}` : where}
              tone={session.visible ? 'text-good' : 'text-muted-foreground'}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{d.decision.reason}</p>
        </Step>

        <Step
          n={3}
          tone="primary"
          icon="chat"
          title={d.message ? `Copy generator (${SOURCE_LABEL[d.message.source]})` : 'Copy generator'}
        >
          {d.message ? (
            <Panel>
              <div className="flex items-start gap-3">
                <NoteIcon name={d.message.icon} priority={d.priority} size="lg" />
                <div className="min-w-0">
                  <p className="font-semibold">{d.message.title}</p>
                  <p className="mt-0.5 text-lg leading-snug">“{d.message.body}”</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="rounded-md">
                  Locale: {d.context.locale}
                </Badge>
                {d.message.latency_ms != null && d.message.source !== 'cache' && (
                  <Badge variant="secondary" className="rounded-md">
                    {d.message.latency_ms} ms
                  </Badge>
                )}
                <Badge variant="secondary" className="rounded-md">
                  Icon: {d.message.icon}
                </Badge>
                <Badge variant="secondary" className="rounded-md">
                  Context: {d.context.view}, {d.context.visible ? 'visible' : 'away'}
                </Badge>
                {d.message.fallback_reason && (
                  <Badge className="rounded-md bg-action/15 text-action">
                    Fallback: {FALLBACK_LABEL[d.message.fallback_reason] ?? d.message.fallback_reason}
                  </Badge>
                )}
              </div>
            </Panel>
          ) : (
            <Panel>
              <p className="text-lg font-bold text-good">No words needed. Rules chose not to speak.</p>
            </Panel>
          )}
        </Step>

        <Step n={4} tone="good" icon="send" title="Delivery channels" last>
          <div className="grid gap-2.5">
            {d.channels.map((c) => {
              const failed = FAILED_STATUSES.has(c.status)
              return (
                <Panel key={c.channel} className={cn('py-3', failed && 'border-dashed')}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                    <span
                      className={cn(
                        'text-sm font-bold uppercase',
                        failed ? 'text-critical' : c.status === 'skipped' ? 'text-muted-foreground' : 'text-good',
                      )}
                    >
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {c.detail && <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>}
                </Panel>
              )
            })}
          </div>
        </Step>
      </ol>
    </Card>
  )
}
