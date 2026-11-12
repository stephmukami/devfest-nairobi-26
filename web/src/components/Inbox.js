import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dayLabel, timeAgo, timeOf } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { parcelCta } from '@/lib/parcelActions';
import { cn } from '@/lib/utils';
import { NoteIcon } from './NoteIcon';
/** Last three timeline steps of a parcel, newest last (the mini tracker under an update). */
function MiniTimeline({ parcel }) {
    const steps = parcel.timeline.slice(-3);
    return (_jsx("ol", { className: "mt-2.5 rounded-lg border bg-muted/50 px-3 py-2.5", children: steps.map((s, i) => {
            const last = i === steps.length - 1;
            return (_jsxs("li", { className: "relative flex items-center gap-2.5 pb-2 text-xs last:pb-0", children: [!last && _jsx("span", { className: "absolute top-3 left-[4.5px] h-full w-px bg-good", "aria-hidden": "true" }), _jsx("span", { className: "relative size-2.5 flex-none rounded-full bg-good" }), _jsxs("span", { className: cn(last ? 'font-semibold text-foreground' : 'text-muted-foreground'), children: [s.label, " (", timeOf(s.at), ")"] })] }, s.event_id));
        }) }));
}
function Row({ item, parcel, latestForParcel, onOpen, onClose, }) {
    // Actions and the tracker reflect the parcel *now*, so only the newest update per parcel gets them.
    const cta = latestForParcel ? parcelCta(parcel) : null;
    return (_jsxs("li", { className: "relative flex gap-3 px-5 py-4", children: [!item.read && (
            // Level with the icon's centre (row padding 1rem + half the 2rem icon).
            _jsx("span", { className: "absolute top-8 left-2 size-1.5 -translate-y-1/2 rounded-full bg-critical", "aria-label": "Unread" })), _jsx(NoteIcon, { name: item.icon, priority: item.priority, size: "sm" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("button", { className: "block w-full text-left", onClick: onOpen, children: [_jsxs("span", { className: "flex items-baseline justify-between gap-3", children: [_jsx("strong", { className: "font-semibold", children: item.title }), _jsx("time", { className: "flex-none text-xs text-muted-foreground", children: timeAgo(item.created_at) })] }), _jsx("span", { className: "mt-0.5 block text-sm text-muted-foreground", children: item.body })] }), cta && (_jsxs("div", { className: "mt-2.5 flex gap-2", children: [_jsx(Button, { size: "sm", onClick: () => {
                                    onClose();
                                    cta.run();
                                }, children: cta.label }), _jsx(Button, { variant: "outline", size: "sm", onClick: onOpen, children: "View parcel" })] })), !cta && latestForParcel && parcel && parcel.timeline.length > 0 && _jsx(MiniTimeline, { parcel: parcel })] })] }));
}
export function Inbox({ items, parcels, onMarkAllRead, onOpenItem }) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('all');
    const unread = items.filter((i) => !i.read).length;
    const shown = tab === 'unread' ? items.filter((i) => !i.read) : items;
    // Items arrive newest first: the first one seen for a parcel is its latest.
    const seen = new Set();
    const groups = [];
    for (const item of shown) {
        const latest = !!item.parcel_id && !seen.has(item.parcel_id);
        if (item.parcel_id)
            seen.add(item.parcel_id);
        const day = dayLabel(item.created_at);
        if (groups.at(-1)?.day !== day)
            groups.push({ day, rows: [] });
        groups.at(-1).rows.push({ item, latest });
    }
    return (_jsxs(Popover, { open: open, onOpenChange: setOpen, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "relative", "aria-label": `Notifications, ${unread} unread`, children: [_jsx(Icon, { name: "bell", size: 22 }), unread > 0 && (_jsx(Badge, { className: "absolute -top-1 -right-1.5 h-5 min-w-5 bg-critical px-1 text-white tabular-nums", children: unread }))] }) }), _jsxs(PopoverContent, { align: "end", sideOffset: 8, collisionPadding: 16, className: "flex max-h-[min(80vh,720px)] w-[min(420px,calc(100vw-32px))] flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-xl", children: [_jsxs("div", { className: "flex items-center gap-2.5 px-5 pt-5 pb-3", children: [_jsx("h3", { className: "text-xl font-bold", children: "Notifications" }), unread > 0 && _jsx(Badge, { className: "h-6 min-w-6 rounded-full tabular-nums", children: unread }), _jsx(Button, { variant: "ghost", size: "icon-sm", className: "ml-auto text-muted-foreground", "aria-label": "Close", onClick: () => setOpen(false), children: _jsx(Icon, { name: "close", size: 18 }) })] }), _jsxs("div", { className: "flex items-center justify-between border-y bg-muted/40 px-5 pt-2", children: [_jsx(Tabs, { value: tab, onValueChange: (v) => setTab(v), children: _jsxs(TabsList, { variant: "line", className: "h-9", children: [_jsxs(TabsTrigger, { value: "all", children: ["All (", items.length, ")"] }), _jsxs(TabsTrigger, { value: "unread", children: ["Unread", unread > 0 ? ` (${unread})` : ''] })] }) }), _jsxs(Button, { variant: "ghost", size: "xs", className: "mb-1.5 font-semibold", disabled: unread === 0, onClick: onMarkAllRead, children: [_jsx(Icon, { name: "readAll", size: 14 }), " Mark all as read"] })] }), _jsxs("div", { className: "min-h-0 flex-1 overflow-y-auto", children: [shown.length === 0 && (_jsx("p", { className: "px-5 py-10 text-center text-sm text-muted-foreground", children: tab === 'unread' ? 'You are all caught up.' : 'Nothing yet.' })), groups.map((g) => (_jsxs("section", { className: "border-b last:border-b-0", children: [_jsx("h4", { className: "px-5 pt-4 text-[0.7rem] font-bold tracking-widest text-muted-foreground", children: g.day }), _jsx("ul", { children: g.rows.map(({ item, latest }) => (_jsx(Row, { item: item, parcel: parcels.find((p) => p.parcel_id === item.parcel_id), latestForParcel: latest, onClose: () => setOpen(false), onOpen: () => {
                                                setOpen(false);
                                                onOpenItem(item);
                                            } }, item.event_id))) })] }, g.day)))] })] })] }));
}
