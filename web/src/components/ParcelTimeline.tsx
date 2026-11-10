import { Button } from '@/components/ui/button'
import { recordAction } from '@/lib/context'
import { timeOf } from '@/lib/format'
import { Icon } from '@/lib/icons'
import type { Parcel } from '@/lib/types'
import { cn } from '@/lib/utils'
import { StatusBadge } from './ParcelList'

interface Props {
  parcel: Parcel | undefined
  flashId: string | null
  onBack: () => void
  onPay: () => void
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="link" className="px-0 font-semibold" onClick={onBack}>
      <Icon name="back" size={16} /> Orders
    </Button>
  )
}

export function ParcelTimeline({ parcel, flashId, onBack, onPay }: Props) {
  if (!parcel) {
    return (
      <section>
        <BackLink onBack={onBack} />
        <p className="text-muted-foreground">Parcel not found for this customer.</p>
      </section>
    )
  }

  const entries = [...parcel.timeline].reverse()
  return (
    <section>
      <BackLink onBack={onBack} />
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h2 className="mb-1 text-xl font-semibold">{parcel.item}</h2>
          <p className="text-muted-foreground">
            {parcel.store} · {parcel.parcel_id}
          </p>
        </div>
        <StatusBadge status={parcel.status} />
      </div>

      <div className="my-3 flex gap-8">
        {parcel.eta_minutes != null && parcel.status !== 'delivered' && (
          <div className="grid">
            <span className="text-sm text-muted-foreground">ETA</span>
            <strong>~{parcel.eta_minutes} min</strong>
          </div>
        )}
        {parcel.rider_first_name && (
          <div className="grid">
            <span className="text-sm text-muted-foreground">Rider</span>
            <strong>{parcel.rider_first_name}</strong>
          </div>
        )}
      </div>

      <div className="mt-3 mb-5 flex flex-wrap gap-2">
        {parcel.status === 'out_for_delivery' && (
          <Button variant="outline" size="lg" onClick={() => recordAction('tapped:track_rider')}>
            Track rider
          </Button>
        )}
        {parcel.status === 'payment_due' && (
          <Button size="lg" onClick={onPay}>
            Pay KES {parcel.fee_kes}
          </Button>
        )}
        {parcel.status === 'needs_address' && (
          <Button size="lg" onClick={() => recordAction('tapped:confirm_address')}>
            Confirm address
          </Button>
        )}
        {parcel.status === 'failed' && (
          <Button size="lg" onClick={() => recordAction('tapped:reschedule')}>
            Reschedule
          </Button>
        )}
      </div>

      <h3 className="mb-2 font-semibold">Timeline</h3>
      <ol>
        {entries.map((e, i) => (
          <li
            key={e.event_id}
            className={cn('flex gap-3 rounded-lg px-2 py-2.5', e.event_id === flashId && 'animate-flash')}
          >
            <span className={cn('mt-1.5 size-2.5 flex-none rounded-full', i === 0 ? 'bg-primary' : 'bg-border')} />
            <div className="grid">
              <strong className="font-semibold">{e.label}</strong>
              <time className="text-sm text-muted-foreground">{timeOf(e.at)}</time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
