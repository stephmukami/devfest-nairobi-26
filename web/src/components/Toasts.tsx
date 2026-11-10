import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/lib/icons'
import { PRIORITY_BORDER_L } from '@/lib/priority'
import type { Priority } from '@/lib/types'
import { cn } from '@/lib/utils'
import { NoteIcon } from './NoteIcon'

export interface Toast {
  id: string
  title: string
  body: string
  icon: string
  priority: Priority
  sticky: boolean
  parcelId: string | null
  via: 'sse' | 'fcm'
}

/** Show (or replace, same id) a notification toast. Sticky ones stay until dismissed or opened. */
export function showToast(t: Toast, onOpen: (t: Toast) => void) {
  toast.custom(
    (id) => (
      <div
        role={t.priority === 'critical' ? 'alert' : 'status'}
        className={cn(
          'relative flex w-[min(356px,calc(100vw-32px))] rounded-xl border border-l-[5px] bg-popover text-popover-foreground shadow-lg',
          PRIORITY_BORDER_L[t.priority],
        )}
      >
        <button
          className="flex flex-1 items-start gap-3 py-3 pl-4 text-left"
          onClick={() => {
            toast.dismiss(id)
            onOpen(t)
          }}
        >
          <NoteIcon name={t.icon} priority={t.priority} />
          <span className="grid min-w-0 gap-0.5 text-sm">
            <strong className="font-semibold">{t.title}</strong>
            <span>{t.body}</span>
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="m-2 text-muted-foreground"
          aria-label="Dismiss"
          onClick={() => toast.dismiss(id)}
        >
          <Icon name="close" size={16} />
        </Button>
        {t.sticky && (
          <Badge className="absolute -top-2.5 right-3 bg-critical text-[0.7rem] font-bold text-white">Needs action</Badge>
        )}
      </div>
    ),
    { id: t.id, duration: t.sticky ? Infinity : 7000 },
  )
}

export const clearToasts = () => toast.dismiss()
