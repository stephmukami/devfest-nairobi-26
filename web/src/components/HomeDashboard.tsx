import { Button } from '@/components/ui/button'
import { ATTENTION_STATUSES, STATUS_LABEL, STATUS_TONE, TONE_TEXT } from '@/lib/format'
import { navigate } from '@/lib/route'
import type { Parcel, Persona } from '@/lib/types'
import { cn } from '@/lib/utils'
import { stretchedLink } from './ParcelList'
import { ParcelThumb } from './ParcelThumb'

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="min-w-0 border-l pl-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-base font-semibold sm:text-lg', tone)}>{value}</p>
    </div>
  )
}

function ParcelRow({ parcel, onOpen }: { parcel: Parcel; onOpen: () => void }) {
  const tone = STATUS_TONE[parcel.status] ?? 'neutral'
  const showEta = parcel.eta_minutes != null && !['delivered', 'failed'].includes(parcel.status)
  return (
    <li className="relative flex items-center gap-3 py-3 transition-colors hover:bg-muted/50 has-[[data-card-link]:focus-visible]:bg-muted/50">
      <ParcelThumb parcel={parcel} />
      <button data-card-link className={cn(stretchedLink, 'grid min-w-0 flex-1')} onClick={onOpen}>
        <strong className="truncate font-semibold">{parcel.item}</strong>
        <span className="truncate text-sm text-muted-foreground">{parcel.store}</span>
      </button>
      <span className="grid flex-none justify-items-end">
        <span className="font-semibold tabular-nums">
          {showEta ? `~${parcel.eta_minutes} min` : parcel.status === 'payment_due' ? `KES ${parcel.fee_kes}` : parcel.parcel_id}
        </span>
        <span className={cn('text-xs font-medium', TONE_TEXT[tone])}>{STATUS_LABEL[parcel.status] ?? parcel.status}</span>
      </span>
    </li>
  )
}

interface Props {
  persona: Persona
  parcels: Parcel[]
  onOpenParcel: (id: string) => void
}

export function HomeDashboard({ persona, parcels, onOpenParcel }: Props) {
  const attention = parcels.filter((p) => ATTENTION_STATUSES.has(p.status))
  const arriving = parcels.filter((p) => p.status === 'out_for_delivery')
  const delivered = parcels.filter((p) => p.status === 'delivered')
  const feesDue = parcels.reduce((sum, p) => sum + (p.status === 'payment_due' ? (p.fee_kes ?? 0) : 0), 0)
  const month = new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })

  // Problems first, then parcels still moving, delivered last.
  const rank = (p: Parcel) => (ATTENTION_STATUSES.has(p.status) ? 0 : p.status === 'delivered' ? 2 : 1)
  const sorted = [...parcels].sort((a, b) => rank(a) - rank(b))

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
      <div className="grid gap-5">
        <h1 className="text-xl font-bold tracking-tight">Hello {persona.name}</h1>

        <section className="rounded-lg bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Delivery overview</h2>
            <span className="text-sm text-muted-foreground">{month}</span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            <Stat label="Arriving" value={arriving.length} tone={arriving.length ? 'text-good' : undefined} />
            <Stat label="Attention" value={attention.length} tone={attention.length ? 'text-action' : undefined} />
            <Stat label="Delivered" value={delivered.length} />
            <Stat label="Fees due" value={feesDue ? `KES ${feesDue}` : '0'} tone={feesDue ? 'text-critical' : undefined} />
          </div>
        </section>
      </div>

      <section className="rounded-lg bg-card px-4 pt-4 pb-1 ring-1 ring-foreground/10 sm:px-5 lg:mt-[4.25rem]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Your parcels</h2>
          <Button variant="link" className="h-auto px-0 text-muted-foreground" onClick={() => navigate('/orders')}>
            See all
          </Button>
        </div>
        {parcels.length === 0 && <p className="py-6 text-sm text-muted-foreground">No parcels yet.</p>}
        <ul className="divide-y">
          {sorted.map((p) => (
            <ParcelRow key={p.parcel_id} parcel={p} onOpen={() => onOpenParcel(p.parcel_id)} />
          ))}
        </ul>
      </section>
    </div>
  )
}
