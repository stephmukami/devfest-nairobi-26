import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { timeOf } from '@/lib/format'
import { Icon } from '@/lib/icons'
import { PRIORITY_BORDER_L } from '@/lib/priority'
import type { InboxItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { NoteIcon } from './NoteIcon'

interface Props {
  items: InboxItem[]
  onOpenPanel: () => void
  onOpenItem: (item: InboxItem) => void
}

export function Inbox({ items, onOpenPanel, onOpenItem }: Props) {
  const [open, setOpen] = useState(false)
  const unread = items.filter((i) => !i.read).length

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) onOpenPanel()
      }}
    >
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
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-32px))] gap-0 p-0">
        <h3 className="px-3 py-2.5 font-semibold">Notifications</h3>
        <Separator />
        <div className="max-h-[70vh] overflow-y-auto p-2">
          {items.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nothing yet.</p>}
          <ul className="grid gap-1.5">
            {items.map((item) => (
              <li key={item.event_id}>
                <button
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-r-md border-l-[3px] px-2.5 py-2 text-left transition-colors hover:bg-muted',
                    PRIORITY_BORDER_L[item.priority],
                    !item.read && 'bg-muted',
                  )}
                  onClick={() => {
                    setOpen(false)
                    onOpenItem(item)
                  }}
                >
                  <NoteIcon name={item.icon} priority={item.priority} size="sm" />
                  <span className="grid min-w-0 gap-0.5 text-sm">
                    <strong className="font-semibold">{item.title}</strong>
                    <span>{item.body}</span>
                    <time className="text-xs text-muted-foreground">{timeOf(item.created_at)}</time>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  )
}
