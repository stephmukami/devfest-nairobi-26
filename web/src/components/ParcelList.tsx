import { Badge } from '@/components/ui/badge'
import { STATUS_LABEL, STATUS_TONE } from '@/lib/format'
import type { Parcel } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ParcelThumb } from './ParcelThumb'

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

/**
 * Clickable card that also holds its own photo button. The card's main button stretches an invisible
 * overlay over the whole card (`stretchedLink`), and the photo sits above it (ParcelThumb is z-10),
 * so the two are separate buttons instead of one nested inside the other.
 */
export const cardBox =
  'relative flex w-full items-center gap-4 rounded-lg bg-card px-4 py-3.5 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-muted/60 has-[[data-card-link]:focus-visible]:ring-3 has-[[data-card-link]:focus-visible]:ring-ring/50'

export const stretchedLink = "text-left outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"

interface Props {
  parcels: Parcel[]
  onOpen: (parcelId: string) => void
  /** Highlighted when the detail is shown beside the list (desktop). */
  selectedId?: string | null
}

export function ParcelList({ parcels, onOpen, selectedId }: Props) {
  return (
    <section>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Your orders</h1>
      <p className="text-muted-foreground">
        From {new Set(parcels.map((p) => p.store)).size} stores, delivered together by Shippy.
      </p>
      <ul className="mt-4 grid gap-2.5">
        {parcels.map((p) => (
          <li
            key={p.parcel_id}
            className={cn(cardBox, p.parcel_id === selectedId && 'bg-primary/5 ring-2 ring-primary')}
          >
            <ParcelThumb parcel={p} />
            <button
              data-card-link
              className={cn(stretchedLink, 'grid min-w-0 flex-1')}
              aria-current={p.parcel_id === selectedId ? 'true' : undefined}
              onClick={() => onOpen(p.parcel_id)}
            >
              <strong className="font-semibold">{p.item}</strong>
              <span className="text-muted-foreground">
                {p.store} · {p.parcel_id}
              </span>
            </button>
            <div className="grid justify-items-end gap-1">
              <StatusBadge status={p.status} />
              {p.eta_minutes != null && p.status !== 'delivered' && (
                <span className="text-sm font-semibold">~{p.eta_minutes} min</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
