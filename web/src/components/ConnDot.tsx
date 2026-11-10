import type { StreamStatus } from '@/lib/sse'
import { cn } from '@/lib/utils'

const TONE: Record<StreamStatus, string> = {
  open: 'bg-good',
  connecting: 'bg-action',
  closed: 'bg-critical',
}

export function ConnDot({ status, label }: { status: StreamStatus; label: string }) {
  return <span className={cn('size-2.5 flex-none rounded-full', TONE[status])} title={`${label}: ${status}`} />
}
