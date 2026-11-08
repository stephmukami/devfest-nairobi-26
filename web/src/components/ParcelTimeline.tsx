import { recordAction } from '../lib/context'
import { timeOf } from '../lib/format'
import type { Parcel } from '../lib/types'
import { StatusBadge } from './ParcelList'

interface Props {
  parcel: Parcel | undefined
  flashId: string | null
  onBack: () => void
  onPay: () => void
}

export function ParcelTimeline({ parcel, flashId, onBack, onPay }: Props) {
  if (!parcel) {
    return (
      <section>
        <button className="link" onClick={onBack}>
          ← Orders
        </button>
        <p className="muted">Parcel not found for this customer.</p>
      </section>
    )
  }

  const entries = [...parcel.timeline].reverse()
  return (
    <section>
      <button className="link" onClick={onBack}>
        ← Orders
      </button>
      <div className="detail-head">
        <div>
          <h2>{parcel.item}</h2>
          <p className="muted">
            {parcel.store} · {parcel.parcel_id}
          </p>
        </div>
        <StatusBadge status={parcel.status} />
      </div>

      <div className="detail-facts">
        {parcel.eta_minutes != null && parcel.status !== 'delivered' && (
          <div>
            <span className="muted">ETA</span>
            <strong>~{parcel.eta_minutes} min</strong>
          </div>
        )}
        {parcel.rider_first_name && (
          <div>
            <span className="muted">Rider</span>
            <strong>{parcel.rider_first_name}</strong>
          </div>
        )}
      </div>

      <div className="actions">
        {parcel.status === 'out_for_delivery' && (
          <button onClick={() => recordAction('tapped:track_rider')}>Track rider</button>
        )}
        {parcel.status === 'payment_due' && (
          <button className="primary" onClick={onPay}>
            Pay KES {parcel.fee_kes}
          </button>
        )}
        {parcel.status === 'needs_address' && (
          <button className="primary" onClick={() => recordAction('tapped:confirm_address')}>
            Confirm address
          </button>
        )}
        {parcel.status === 'failed' && (
          <button className="primary" onClick={() => recordAction('tapped:reschedule')}>
            Reschedule
          </button>
        )}
      </div>

      <h3>Timeline</h3>
      <ol className="timeline">
        {entries.map((e) => (
          <li key={e.event_id} className={e.event_id === flashId ? 'flash' : ''}>
            <span className="dot" />
            <div>
              <strong>{e.label}</strong>
              <time className="muted">{timeOf(e.at)}</time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
