import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from '@/components/ui/button';
import { ATTENTION_STATUSES, STATUS_LABEL, STATUS_TONE, TONE_TEXT } from '@/lib/format';
import { navigate } from '@/lib/route';
import { cn } from '@/lib/utils';
import { stretchedLink } from './ParcelList';
import { ParcelThumb } from './ParcelThumb';
function Stat({ label, value, tone }) {
    return (_jsxs("div", { className: "min-w-0 border-l pl-3", children: [_jsx("p", { className: "truncate text-xs text-muted-foreground", children: label }), _jsx("p", { className: cn('text-base font-semibold sm:text-lg', tone), children: value })] }));
}
function ParcelRow({ parcel, onOpen }) {
    const tone = STATUS_TONE[parcel.status] ?? 'neutral';
    const showEta = parcel.eta_minutes != null && !['delivered', 'failed'].includes(parcel.status);
    return (_jsxs("li", { className: "relative flex items-center gap-3 py-3 transition-colors hover:bg-muted/50 has-[[data-card-link]:focus-visible]:bg-muted/50", children: [_jsx(ParcelThumb, { parcel: parcel }), _jsxs("button", { "data-card-link": true, className: cn(stretchedLink, 'grid min-w-0 flex-1'), onClick: onOpen, children: [_jsx("strong", { className: "truncate font-semibold", children: parcel.item }), _jsx("span", { className: "truncate text-sm text-muted-foreground", children: parcel.store })] }), _jsxs("span", { className: "grid flex-none justify-items-end", children: [_jsx("span", { className: "font-semibold tabular-nums", children: showEta ? `~${parcel.eta_minutes} min` : parcel.status === 'payment_due' ? `KES ${parcel.fee_kes}` : parcel.parcel_id }), _jsx("span", { className: cn('text-xs font-medium', TONE_TEXT[tone]), children: STATUS_LABEL[parcel.status] ?? parcel.status })] })] }));
}
export function HomeDashboard({ persona, parcels, onOpenParcel }) {
    const attention = parcels.filter((p) => ATTENTION_STATUSES.has(p.status));
    const arriving = parcels.filter((p) => p.status === 'out_for_delivery');
    const delivered = parcels.filter((p) => p.status === 'delivered');
    const feesDue = parcels.reduce((sum, p) => sum + (p.status === 'payment_due' ? (p.fee_kes ?? 0) : 0), 0);
    const month = new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    // Problems first, then parcels still moving, delivered last.
    const rank = (p) => (ATTENTION_STATUSES.has(p.status) ? 0 : p.status === 'delivered' ? 2 : 1);
    const sorted = [...parcels].sort((a, b) => rank(a) - rank(b));
    return (_jsxs("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start", children: [_jsxs("div", { className: "grid gap-5", children: [_jsxs("h1", { className: "text-xl font-bold tracking-tight", children: ["Hello ", persona.name] }), _jsxs("section", { className: "rounded-lg bg-card p-4 ring-1 ring-foreground/10 sm:p-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h2", { className: "font-semibold", children: "Delivery overview" }), _jsx("span", { className: "text-sm text-muted-foreground", children: month })] }), _jsxs("div", { className: "mt-4 grid grid-cols-4 gap-2", children: [_jsx(Stat, { label: "Arriving", value: arriving.length, tone: arriving.length ? 'text-good' : undefined }), _jsx(Stat, { label: "Attention", value: attention.length, tone: attention.length ? 'text-action' : undefined }), _jsx(Stat, { label: "Delivered", value: delivered.length }), _jsx(Stat, { label: "Fees due", value: feesDue ? `KES ${feesDue}` : '0', tone: feesDue ? 'text-critical' : undefined })] })] })] }), _jsxs("section", { className: "rounded-lg bg-card px-4 pt-4 pb-1 ring-1 ring-foreground/10 sm:px-5 lg:mt-[4.25rem]", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h2", { className: "font-semibold", children: "Your parcels" }), _jsx(Button, { variant: "link", className: "h-auto px-0 text-muted-foreground", onClick: () => navigate('/orders'), children: "See all" })] }), parcels.length === 0 && _jsx("p", { className: "py-6 text-sm text-muted-foreground", children: "No parcels yet." }), _jsx("ul", { className: "divide-y", children: sorted.map((p) => (_jsx(ParcelRow, { parcel: p, onOpen: () => onOpenParcel(p.parcel_id) }, p.parcel_id))) })] })] }));
}
