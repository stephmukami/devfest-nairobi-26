import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { dayLabel, timeAgo, timeOf } from '@/lib/format'
import { Icon } from '@/lib/icons'
import { parcelCta } from '@/lib/parcelActions'
import type { InboxItem, Parcel } from '@/lib/types'
import { cn } from '@/lib/utils'
import { NoteIcon } from './NoteIcon'

interface Props {
  items: InboxItem[]
  parcels: Parcel[]
  onMarkAllRead: () => void
  onOpenItem: (item: InboxItem) => void
}

/** Last three timeline steps of a parcel, newest last (the mini tracker under an update). */
function MiniTimeline({ parcel }: { parcel: Parcel }) {
  const steps = parcel.timeline.slice(-3)
  return (
    <ol className="mt-2.5 rounded-lg border bg-muted/50 px-3 py-2.5">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        return (
          <li key={s.event_id} className="relative flex items-center gap-2.5 pb-2 text-xs last:pb-0">
            {!last && <span className="absolute top-3 left-[4.5px] h-full w-px bg-good" aria-hidden="true" />}
            <span className="relative size-2.5 flex-none rounded-full bg-good" />
            <span className={cn(last ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {s.label} ({timeOf(s.at)})
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Row({
  item,
  parcel,
  latestForParcel,
  onOpen,
  onClose,
}: {
  item: InboxItem
  parcel: Parcel | undefined
  latestForParcel: boolean
  onOpen: () => void
  onClose: () => void
}) {
  // Actions and the tracker reflect the parcel *now*, so only the newest update per parcel gets them.
  const cta = latestForParcel ? parcelCta(parcel) : null
  return (
    <li className="relative flex gap-3 px-5 py-4">
      {!item.read && (
        // Level with the icon's centre (row padding 1rem + half the 2rem icon).
        <span className="absolute top-8 left-2 size-1.5 -translate-y-1/2 rounded-full bg-critical" aria-label="Unread" />
      )}
      <NoteIcon name={item.icon} priority={item.priority} size="sm" />
      <div className="min-w-0 flex-1">
        <button className="block w-full text-left" onClick={onOpen}>
          <span className="flex items-baseline justify-between gap-3">
            <strong className="font-semibold">{item.title}</strong>
            <time className="flex-none text-xs text-muted-foreground">{timeAgo(item.created_at)}</time>
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{item.body}</span>
        </button>
        {cta && (
          <div className="mt-2.5 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onClose()
                cta.run()
              }}
            >
              {cta.label}
            </Button>
            <Button variant="outline" size="sm" onClick={onOpen}>
              View parcel
            </Button>
          </div>
        )}
        {!cta && latestForParcel && parcel && parcel.timeline.length > 0 && <MiniTimeline parcel={parcel} />}
      </div>
    </li>
  )
}

export function Inbox({ items, parcels, onMarkAllRead, onOpenItem }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const unread = items.filter((i) => !i.read).length
  const shown = tab === 'unread' ? items.filter((i) => !i.read) : items

  // Items arrive newest first: the first one seen for a parcel is its latest.
  const seen = new Set<string>()
  const groups: { day: string; rows: { item: InboxItem; latest: boolean }[] }[] = []
  for (const item of shown) {
    const latest = !!item.parcel_id && !seen.has(item.parcel_id)
    if (item.parcel_id) seen.add(item.parcel_id)
    const day = dayLabel(item.created_at)
    if (groups.at(-1)?.day !== day) groups.push({ day, rows: [] })
    groups.at(-1)!.rows.push({ item, latest })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} unread`}>
          <Icon name="bell" size={22} />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1.5 h-5 min-w-5 bg-critical px-1 text-white tabular-nums">
              {unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      {/* Right-aligned under the bell; collisionPadding keeps a 16px gap to both screen edges on phones. */}
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        className="flex max-h-[min(80vh,720px)] w-[min(420px,calc(100vw-32px))] flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-xl"
      >
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
          <h3 className="text-xl font-bold">Notifications</h3>
          {unread > 0 && <Badge className="h-6 min-w-6 rounded-full tabular-nums">{unread}</Badge>}
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-muted-foreground"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" size={18} />
          </Button>
        </div>

        <div className="flex items-center justify-between border-y bg-muted/40 px-5 pt-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'unread')}>
            <TabsList variant="line" className="h-9">
              <TabsTrigger value="all">All ({items.length})</TabsTrigger>
              <TabsTrigger value="unread">Unread{unread > 0 ? ` (${unread})` : ''}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="xs" className="mb-1.5 font-semibold" disabled={unread === 0} onClick={onMarkAllRead}>
            <Icon name="readAll" size={14} /> Mark all as read
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {shown.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {tab === 'unread' ? 'You are all caught up.' : 'Nothing yet.'}
            </p>
          )}
          {groups.map((g) => (
            <section key={g.day} className="border-b last:border-b-0">
              <h4 className="px-5 pt-4 text-[0.7rem] font-bold tracking-widest text-muted-foreground">{g.day}</h4>
              <ul>
                {g.rows.map(({ item, latest }) => (
                  <Row
                    key={item.event_id}
                    item={item}
                    parcel={parcels.find((p) => p.parcel_id === item.parcel_id)}
                    latestForParcel={latest}
                    onClose={() => setOpen(false)}
                    onOpen={() => {
                      setOpen(false)
                      onOpenItem(item)
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
