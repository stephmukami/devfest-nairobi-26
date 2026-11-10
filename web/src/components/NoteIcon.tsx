import { NotificationIcon } from '@/lib/icons'
import { PRIORITY_TEXT } from '@/lib/priority'
import type { Priority } from '@/lib/types'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: { box: 'size-8', icon: 18 },
  md: { box: 'size-9', icon: 22 },
  lg: { box: 'size-12', icon: 28 },
}

/** Notification icon on a tinted tile, shared by toasts, the inbox and the inspector preview. */
export function NoteIcon({ name, priority, size = 'md' }: { name: string; priority?: Priority; size?: keyof typeof SIZES }) {
  const s = SIZES[size]
  return (
    <span
      className={cn(
        'grid flex-none place-items-center rounded-[10px] bg-current/15',
        s.box,
        priority ? PRIORITY_TEXT[priority] : 'text-primary',
      )}
    >
      <NotificationIcon name={name} size={s.icon} />
    </span>
  )
}
