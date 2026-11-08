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

export function shortType(type: string): string {
  return type.split('.').pop()!.replace(/_/g, ' ')
}
