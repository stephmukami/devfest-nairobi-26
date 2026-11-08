import { STATUS_LABEL, STATUS_TONE } from '../lib/format'
import type { Parcel } from '../lib/types'

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status status-${STATUS_TONE[status] ?? 'neutral'}`}>{STATUS_LABEL[status] ?? status}</span>
}

interface Props {
  parcels: Parcel[]
  onOpen: (parcelId: string) => void
}

export function ParcelList({ parcels, onOpen }: Props) {
  return (
    <section>
      <h2>Your orders</h2>
      <p className="muted">From {new Set(parcels.map((p) => p.store)).size} stores, delivered together by Shippy.</p>
      <ul className="parcel-list">
        {parcels.map((p) => (
          <li key={p.parcel_id}>
            <button className="parcel-card" onClick={() => onOpen(p.parcel_id)}>
              <div>
                <strong>{p.item}</strong>
                <span className="muted">
                  {p.store} · {p.parcel_id}
                </span>
              </div>
              <div className="parcel-card-right">
                <StatusBadge status={p.status} />
                {p.eta_minutes != null && p.status !== 'delivered' && <span className="eta">~{p.eta_minutes} min</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
