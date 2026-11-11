import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Icon } from '@/lib/icons'
import type { ParcelCta } from '@/lib/parcelActions'
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
  /** The parcel's next step (Pay, Reschedule, ...), when it has one. */
  cta: ParcelCta | null
  via: 'sse' | 'fcm'
}

const DURATION_MS = 8000

// Outer tinted frame and footer accent per priority (info is the neutral "heads up" style).
const FRAME: Record<Priority, string> = {
  info: 'bg-muted border-border',
  action: 'bg-action/10 border-action/30',
  critical: 'bg-critical/10 border-critical/30',
}
const ACCENT: Record<Priority, string> = {
  info: 'text-foreground',
  action: 'text-action',
  critical: 'text-critical',
}

/** "This message will disappear in 7sec", paused while the pointer is over the toast (Sonner pauses too). */
function Countdown({ paused, priority }: { paused: boolean; priority: Priority }) {
  const [left, setLeft] = useState(Math.round(DURATION_MS / 1000))
  useEffect(() => {
    if (paused) return
    const t = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(t)
  }, [paused])
  return (
    <>
      This message will disappear in <span className={cn('font-semibold', ACCENT[priority])}>{left}sec</span>
    </>
  )
}

function ToastCard({ t, id, onOpen }: { t: Toast; id: string | number; onOpen: (t: Toast) => void }) {
  const [hover, setHover] = useState(false)
  const close = () => toast.dismiss(id)

  return (
    <div
      role={t.priority === 'critical' ? 'alert' : 'status'}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn('w-[min(400px,calc(100vw-32px))] rounded-lg border p-1.5', FRAME[t.priority])}
    >
      {/* flex-wrap: on narrow phones the buttons drop below the text instead of squeezing it. */}
      <div className="flex flex-wrap items-start gap-3 rounded-lg bg-card p-3 text-card-foreground shadow-sm">
        <NoteIcon name={t.icon} priority={t.priority} />
        <button
          className="grid min-w-40 flex-1 gap-0.5 text-left text-sm"
          onClick={() => {
            close()
            onOpen(t)
          }}
        >
          <strong className="font-semibold">{t.title}</strong>
          <span className="text-muted-foreground">{t.body}</span>
        </button>
        <div className="ml-auto flex flex-none items-center gap-1">
          {t.cta && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                close()
                t.cta!.run()
              }}
            >
              {t.cta.label}
            </Button>
          )}
          {t.parcelId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                close()
                onOpen(t)
              }}
            >
              View
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Dismiss" onClick={close}>
            <Icon name="close" size={16} />
          </Button>
        </div>
      </div>
      <p className="px-3 pt-1.5 pb-1 text-center text-xs text-muted-foreground">
        {t.sticky ? (
          <>
            <span className={cn('font-semibold', ACCENT[t.priority])}>Needs action.</span> This stays until you open or
            dismiss it.
          </>
        ) : (
          <Countdown paused={hover} priority={t.priority} />
        )}
      </p>
    </div>
  )
}

/** Show (or replace, same id) a notification toast through Sonner. Sticky ones stay until dismissed or opened. */
export function showToast(t: Toast, onOpen: (t: Toast) => void) {
  toast.custom((id) => <ToastCard t={t} id={id} onOpen={onOpen} />, {
    id: t.id,
    duration: t.sticky ? Infinity : DURATION_MS,
  })
}

export const clearToasts = () => toast.dismiss()
