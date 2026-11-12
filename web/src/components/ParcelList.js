import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ParcelThumb } from './ParcelThumb';
const TONE_CLASS = {
    neutral: 'bg-muted text-muted-foreground',
    good: 'bg-good/15 text-good',
    warn: 'bg-action/15 text-action',
    bad: 'bg-critical/15 text-critical',
};
export function StatusBadge({ status }) {
    return (_jsx(Badge, { variant: "secondary", className: cn('font-semibold', TONE_CLASS[STATUS_TONE[status] ?? 'neutral']), children: STATUS_LABEL[status] ?? status }));
}
/**
 * Clickable card that also holds its own photo button. The card's main button stretches an invisible
 * overlay over the whole card (`stretchedLink`), and the photo sits above it (ParcelThumb is z-10),
 * so the two are separate buttons instead of one nested inside the other.
 */
export const cardBox = 'relative flex w-full items-center gap-4 rounded-lg bg-card px-4 py-3.5 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-muted/60 has-[[data-card-link]:focus-visible]:ring-3 has-[[data-card-link]:focus-visible]:ring-ring/50';
export const stretchedLink = "text-left outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']";
export function ParcelList({ parcels, onOpen, selectedId }) {
    return (_jsxs("section", { children: [_jsx("h1", { className: "mb-1 text-2xl font-bold tracking-tight", children: "Your orders" }), _jsxs("p", { className: "text-muted-foreground", children: ["From ", new Set(parcels.map((p) => p.store)).size, " stores, delivered together by Shippy."] }), _jsx("ul", { className: "mt-4 grid gap-2.5", children: parcels.map((p) => (_jsxs("li", { className: cn(cardBox, p.parcel_id === selectedId && 'bg-primary/5 ring-2 ring-primary'), children: [_jsx(ParcelThumb, { parcel: p }), _jsxs("button", { "data-card-link": true, className: cn(stretchedLink, 'grid min-w-0 flex-1'), "aria-current": p.parcel_id === selectedId ? 'true' : undefined, onClick: () => onOpen(p.parcel_id), children: [_jsx("strong", { className: "font-semibold", children: p.item }), _jsxs("span", { className: "text-muted-foreground", children: [p.store, " \u00B7 ", p.parcel_id] })] }), _jsxs("div", { className: "grid justify-items-end gap-1", children: [_jsx(StatusBadge, { status: p.status }), p.eta_minutes != null && p.status !== 'delivered' && (_jsxs("span", { className: "text-sm font-semibold", children: ["~", p.eta_minutes, " min"] }))] })] }, p.parcel_id))) })] }));
}
