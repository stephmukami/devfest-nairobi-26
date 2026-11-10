import type { IconName } from './types'

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

export const STATUS_ICON: Record<string, IconName> = {
  confirmed: 'store',
  at_hub: 'warehouse',
  in_transit: 'truck',
  out_for_delivery: 'rider',
  payment_due: 'payment',
  delayed: 'clock',
  needs_address: 'location',
  failed: 'alert',
  delivered: 'delivered',
}

export const TONE_TEXT = {
  neutral: 'text-muted-foreground',
  good: 'text-good',
  warn: 'text-action',
  bad: 'text-critical',
} as const

/** Statuses where the customer has to do something (or should know about a problem). */
export const ATTENTION_STATUSES = new Set(['payment_due', 'needs_address', 'failed', 'delayed'])

/** "Good morning" in the persona's language. */
export function greeting(locale: string, hour = new Date().getHours()): string {
  const sw = locale.startsWith('sw')
  if (hour < 12) return sw ? 'Habari za asubuhi' : 'Good morning'
  if (hour < 17) return sw ? 'Habari za mchana' : 'Good afternoon'
  return sw ? 'Habari za jioni' : 'Good evening'
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

const LOWERCASE_WORDS = new Set(['at', 'by', 'for', 'of', 'to'])

/** "parcel.received_at_hub" -> "Parcel Received at Hub". */
export function eventLabel(type: string): string {
  return type
    .split(/[._]/)
    .map((w, i) => (i > 0 && LOWERCASE_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

export function shortType(type: string): string {
  return type.split('.').pop()!.replace(/_/g, ' ')
}
