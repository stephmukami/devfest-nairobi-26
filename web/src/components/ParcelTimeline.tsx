import { Button } from '@/components/ui/button'
import { timeOf } from '@/lib/format'
import { Icon } from '@/lib/icons'
import { parcelCta } from '@/lib/parcelActions'
import type { Parcel } from '@/lib/types'
import { cn } from '@/lib/utils'
import { StatusBadge } from './ParcelList'

interface Props {
  parcel: Parcel | undefined
  flashId: string | null
  onBack: () => void
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    // Desktop shows the list beside the detail, so the back link is phone-only.
    <Button variant="link" className="px-0 font-semibold lg:hidden" onClick={onBack}>
      <Icon name="back" size={16} /> Orders
    </Button>
  )
}

export function ParcelTimeline({ parcel, flashId, onBack }: Props) {
  if (!parcel) {
    return (
      <section>
        <BackLink onBack={onBack} />
        <p className="text-muted-foreground">Parcel not found for this customer.</p>
      </section>
    )
  }

  const entries = [...parcel.timeline].reverse()
  const cta = parcelCta(parcel)
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

      {cta && (
        <div className="mt-3 mb-5 flex flex-wrap gap-2">
          <Button variant={parcel.status === 'out_for_delivery' ? 'outline' : 'default'} size="lg" onClick={cta.run}>
            {cta.label}
          </Button>
        </div>
      )}

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
