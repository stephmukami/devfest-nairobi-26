import { Badge } from '@/components/ui/badge'
import { STATUS_LABEL, STATUS_TONE } from '@/lib/format'
import type { Parcel } from '@/lib/types'
import { cn } from '@/lib/utils'

const TONE_CLASS = {
  neutral: 'bg-muted text-muted-foreground',
  good: 'bg-good/15 text-good',
  warn: 'bg-action/15 text-action',
  bad: 'bg-critical/15 text-critical',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn('font-semibold', TONE_CLASS[STATUS_TONE[status] ?? 'neutral'])}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

/** Card-styled button (a Card is a div, which cannot sit inside a button). */
export const cardButton =
  'flex w-full items-center justify-between gap-4 rounded-xl bg-card px-4 py-3.5 text-left text-sm ring-1 ring-foreground/10 transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'

interface Props {
  parcels: Parcel[]
  onOpen: (parcelId: string) => void
}

export function ParcelList({ parcels, onOpen }: Props) {
  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold">Your orders</h2>
      <p className="text-muted-foreground">
        From {new Set(parcels.map((p) => p.store)).size} stores, delivered together by Shippy.
      </p>
      <ul className="mt-4 grid gap-2.5">
        {parcels.map((p) => (
          <li key={p.parcel_id}>
            <button className={cardButton} onClick={() => onOpen(p.parcel_id)}>
              <div className="grid min-w-0">
                <strong className="font-semibold">{p.item}</strong>
                <span className="text-muted-foreground">
                  {p.store} · {p.parcel_id}
                </span>
              </div>
              <div className="grid justify-items-end gap-1">
                <StatusBadge status={p.status} />
                {p.eta_minutes != null && p.status !== 'delivered' && (
                  <span className="text-sm font-semibold">~{p.eta_minutes} min</span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
