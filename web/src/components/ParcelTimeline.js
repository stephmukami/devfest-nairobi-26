import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from '@/components/ui/button';
import { timeOf } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { parcelCta } from '@/lib/parcelActions';
import { cn } from '@/lib/utils';
import { StatusBadge } from './ParcelList';
import { ParcelThumb } from './ParcelThumb';
function BackLink({ onBack }) {
    return (
    // Desktop shows the list beside the detail, so the back link is phone-only.
    _jsxs(Button, { variant: "link", className: "px-0 font-semibold lg:hidden", onClick: onBack, children: [_jsx(Icon, { name: "back", size: 16 }), " Orders"] }));
}
export function ParcelTimeline({ parcel, flashId, onBack }) {
    if (!parcel) {
        return (_jsxs("section", { children: [_jsx(BackLink, { onBack: onBack }), _jsx("p", { className: "text-muted-foreground", children: "Parcel not found for this customer." })] }));
    }
    const entries = [...parcel.timeline].reverse();
    const cta = parcelCta(parcel);
    return (_jsxs("section", { children: [_jsx(BackLink, { onBack: onBack }), _jsxs("div", { className: "mt-2 flex items-start gap-4", children: [_jsx(ParcelThumb, { parcel: parcel, size: "lg" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h2", { className: "mb-1 text-xl font-semibold", children: parcel.item }), _jsxs("p", { className: "text-muted-foreground", children: [parcel.store, " \u00B7 ", parcel.parcel_id] })] }), _jsx(StatusBadge, { status: parcel.status })] }), _jsxs("div", { className: "my-3 flex gap-8", children: [parcel.eta_minutes != null && parcel.status !== 'delivered' && (_jsxs("div", { className: "grid", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "ETA" }), _jsxs("strong", { children: ["~", parcel.eta_minutes, " min"] })] })), parcel.rider_first_name && (_jsxs("div", { className: "grid", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Rider" }), _jsx("strong", { children: parcel.rider_first_name })] }))] }), cta && (_jsx("div", { className: "mt-3 mb-5 flex flex-wrap gap-2", children: _jsx(Button, { variant: parcel.status === 'out_for_delivery' ? 'outline' : 'default', size: "lg", onClick: cta.run, children: cta.label }) })), _jsx("h3", { className: "mb-2 font-semibold", children: "Timeline" }), _jsx("ol", { children: entries.map((e, i) => (_jsxs("li", { className: cn('flex gap-3 rounded-lg px-2 py-2.5', e.event_id === flashId && 'animate-flash'), children: [_jsx("span", { className: cn('mt-1.5 size-2.5 flex-none rounded-full', i === 0 ? 'bg-primary' : 'bg-border') }), _jsxs("div", { className: "grid", children: [_jsx("strong", { className: "font-semibold", children: e.label }), _jsx("time", { className: "text-sm text-muted-foreground", children: timeOf(e.at) })] })] }, e.event_id))) })] }));
}
