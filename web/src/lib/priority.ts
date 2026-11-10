// Full class names (not built from strings) so Tailwind can see them.
import type { Priority } from './types'

export const PRIORITY_TEXT: Record<Priority, string> = {
  info: 'text-info',
  action: 'text-action',
  critical: 'text-critical',
}

export const PRIORITY_BORDER_L: Record<Priority, string> = {
  info: 'border-l-info',
  action: 'border-l-action',
  critical: 'border-l-critical',
}

export const PRIORITY_BORDER_B: Record<Priority, string> = {
  info: 'border-b-info',
  action: 'border-b-action',
  critical: 'border-b-critical',
}
