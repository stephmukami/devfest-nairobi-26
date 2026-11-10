export const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  at_hub: 'At hub',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  payment_due: 'Fee due',
  delayed: 'Delayed',
  needs_address: 'Needs address',
  failed: 'Delivery failed',
  delivered: 'Delivered',
}

export const STATUS_TONE: Record<string, 'neutral' | 'good' | 'warn' | 'bad'> = {
  confirmed: 'neutral',
  at_hub: 'neutral',
  in_transit: 'neutral',
  out_for_delivery: 'good',
  payment_due: 'warn',
  delayed: 'warn',
  needs_address: 'bad',
  failed: 'bad',
  delivered: 'good',
}

export function timeOf(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const min = Math.floor((now - t) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ago`
  const days = Math.floor(h / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** Group heading for a list of dated items, e.g. "10 NOVEMBER 2026". */
export function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
}

export function shortType(type: string): string {
  return type.split('.').pop()!.replace(/_/g, ' ')
}
