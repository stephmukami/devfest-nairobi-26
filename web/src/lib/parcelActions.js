import { recordAction } from './context';
import { navigate } from './route';
/** The one thing the customer can do next for a parcel, if any. Shared by the parcel page, inbox and toasts. */
export function parcelCta(parcel) {
    switch (parcel?.status) {
        case 'out_for_delivery':
            return { label: 'Track rider', run: () => recordAction('tapped:track_rider') };
        case 'payment_due':
            return { label: `Pay KES ${parcel.fee_kes}`, run: () => navigate('/payment') };
        case 'needs_address':
            return { label: 'Confirm address', run: () => recordAction('tapped:confirm_address') };
        case 'failed':
            return { label: 'Reschedule', run: () => recordAction('tapped:reschedule') };
        default:
            return null;
    }
}
export function openParcel(id) {
    recordAction(`opened_parcel:${id}`);
    navigate(`/parcels/${id}`);
}
