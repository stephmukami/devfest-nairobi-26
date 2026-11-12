import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { shortType, timeOf } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { PRIORITY_TEXT } from '@/lib/priority';
import { cn } from '@/lib/utils';
import { NoteIcon } from './NoteIcon';
const ACTION_LABEL = {
    toast: 'SSE toast',
    inline: 'Inline update',
    push: 'FCM push',
    inbox_only: 'Inbox only',
};
const ACTION_TEXT = {
    toast: 'text-info',
    inline: 'text-good',
    push: 'text-action',
    inbox_only: 'text-muted-foreground',
};
const SOURCE_LABEL = {
    gemini: 'Gemini',
    cache: 'Gemini, cached',
    template: 'Template',
};
const FALLBACK_LABEL = {
    kill_switch: 'Gemini switched off',
    timeout: 'Gemini timed out',
    gemini_not_configured: 'No Gemini key',
};
// Gemini API errors arrive as "error:<HTTP code> <STATUS>", e.g. "error:402 RESOURCE_EXHAUSTED".
const GEMINI_HTTP_LABEL = {
    '400': 'Gemini rejected the request',
    '401': 'Gemini key rejected',
    '402': 'Gemini credits used up',
    '403': 'Gemini key not allowed',
    '404': 'Gemini model not found',
    '429': 'Gemini rate limit or quota hit',
};
function fallbackLabel(reason) {
    if (FALLBACK_LABEL[reason])
        return FALLBACK_LABEL[reason];
    const code = /^error:(\d{3})/.exec(reason)?.[1];
    if (code && GEMINI_HTTP_LABEL[code])
        return `${GEMINI_HTTP_LABEL[code]} (${code})`;
    if (code?.startsWith('5'))
        return `Gemini server error (${code})`;
    return reason;
}
const CHANNEL_LABEL = {
    sse: 'SSE stream',
    fcm: 'FCM push',
    inbox: 'Inbox',
    inline: 'Inline update',
};
const FAILED_STATUSES = new Set(['error', 'no_tokens', 'disabled']);
function eventJson(d) {
    const shown = d.events.map(({ user_id: _u, ...rest }) => rest);
    return JSON.stringify(shown.length === 1 ? shown[0] : shown, null, 2);
}
const STEP_ICON = {
    info: 'text-info',
    action: 'text-action',
    primary: 'text-primary',
    good: 'text-good',
};
function Step({ n, tone, icon, title, last, children, }) {
    return (_jsxs("li", { className: "relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 pb-8 last:pb-0 sm:gap-6", children: [!last && _jsx("span", { className: "absolute top-12 bottom-2 left-5 w-px bg-border", "aria-hidden": "true" }), _jsx("span", { className: "relative mt-3 grid size-10 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground ring-4 ring-card", children: n }), _jsxs("section", { className: "min-w-0 rounded-lg border bg-muted/50 p-4 sm:p-5", children: [_jsxs("h3", { className: "mb-3.5 flex items-center gap-2 text-sm font-bold tracking-widest text-muted-foreground uppercase", children: [_jsx(Icon, { name: icon, size: 18, className: STEP_ICON[tone] }), title] }), children] })] }));
}
/** White box inside a step. */
function Panel({ className, children }) {
    return _jsx("div", { className: cn('rounded-lg border bg-card p-3.5', className), children: children });
}
function Stat({ label, value, tone }) {
    return (_jsxs(Panel, { className: "flex items-center justify-between gap-3 py-3", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: label }), _jsx("span", { className: cn('text-sm font-bold uppercase', tone), children: value })] }));
}
function Header({ status, deliveryId }) {
    return (_jsxs("div", { className: "flex flex-wrap items-center gap-3 border-b px-6 py-5", children: [_jsxs("h2", { className: "flex items-center gap-2.5 text-lg font-bold", children: [_jsx(Icon, { name: "pipeline", size: 22 }), " Channel Inspector"] }), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [_jsx(Badge, { className: cn('rounded-md px-2.5 py-1 text-[0.7rem] font-bold uppercase', status === 'open' ? 'bg-primary/15 text-primary' : 'bg-action/15 text-action'), children: status === 'open' ? 'Live pipeline' : status === 'connecting' ? 'Connecting' : 'Offline' }), deliveryId && (_jsxs(Badge, { variant: "secondary", className: "rounded-md px-2.5 py-1 font-mono text-[0.7rem]", children: ["ID: ", deliveryId] }))] })] }));
}
/** One card per event type (digests together), newest first, with how many times it fired. */
function groupRecent(deliveries) {
    const groups = new Map();
    for (const x of deliveries) {
        const key = x.kind === 'digest' ? 'digest' : x.events[0].type;
        const g = groups.get(key);
        if (g) {
            g.count += 1;
            g.ids.add(x.id);
        }
        else {
            groups.set(key, {
                key,
                label: key === 'digest' ? 'digest' : shortType(key),
                priority: x.priority,
                latest: x,
                count: 1,
                ids: new Set([x.id]),
            });
        }
    }
    return [...groups.values()];
}
/** The pipeline while an event is being processed: real step headings, skeleton content. */
function PendingSteps({ label }) {
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2.5 border-b px-6 py-3 text-sm", role: "status", children: [_jsx("span", { className: "size-2 animate-pulse rounded-full bg-primary" }), _jsxs("span", { children: ["Processing ", _jsx("span", { className: "font-semibold", children: label }), "\u2026"] })] }), _jsxs("ol", { className: "px-4 py-6 sm:px-6", "aria-busy": "true", children: [_jsx(Step, { n: 1, tone: "info", icon: "code", title: "Event facts", children: _jsx(Panel, { className: "grid gap-2", children: ['w-1/3', 'w-1/2', 'w-2/5', 'w-1/4', 'w-3/5', 'w-2/5'].map((w, i) => (_jsx(Skeleton, { className: cn('h-3.5', w, i > 0 && i < 5 && 'ml-4') }, i))) }) }), _jsxs(Step, { n: 2, tone: "action", icon: "scale", title: "Decision logic", children: [_jsx("div", { className: "grid gap-2.5 sm:grid-cols-2", children: Array.from({ length: 4 }, (_, i) => (_jsxs(Panel, { className: "flex items-center justify-between py-3", children: [_jsx(Skeleton, { className: "h-4 w-24" }), _jsx(Skeleton, { className: "h-4 w-16" })] }, i))) }), _jsx(Skeleton, { className: "mt-3 h-3.5 w-3/4" })] }), _jsx(Step, { n: 3, tone: "primary", icon: "chat", title: "Copy generator", children: _jsxs(Panel, { children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Skeleton, { className: "size-12 flex-none rounded-full" }), _jsxs("div", { className: "grid flex-1 gap-2", children: [_jsx(Skeleton, { className: "h-4 w-1/2" }), _jsx(Skeleton, { className: "h-5 w-full" }), _jsx(Skeleton, { className: "h-5 w-4/5" })] })] }), _jsxs("div", { className: "mt-3 flex gap-1.5", children: [_jsx(Skeleton, { className: "h-5 w-24" }), _jsx(Skeleton, { className: "h-5 w-16" }), _jsx(Skeleton, { className: "h-5 w-20" })] })] }) }), _jsx(Step, { n: 4, tone: "good", icon: "send", title: "Delivery channels", last: true, children: _jsx("div", { className: "grid gap-2.5", children: Array.from({ length: 3 }, (_, i) => (_jsxs(Panel, { className: "flex items-center justify-between py-3", children: [_jsx(Skeleton, { className: "h-4 w-28" }), _jsx(Skeleton, { className: "h-4 w-14" })] }, i))) }) })] })] }));
}
export function ChannelInspector({ deliveries, status, pending, }) {
    const [selectedId, setSelectedId] = useState(null);
    const latest = deliveries[0];
    // Follow the newest delivery unless the presenter pinned an older one.
    useEffect(() => setSelectedId(null), [latest?.id]);
    const d = deliveries.find((x) => x.id === selectedId) ?? latest;
    if (pending) {
        return (_jsxs(Card, { className: "min-w-0 gap-0 rounded-lg py-0", children: [_jsx(Header, { status: status }), _jsx(PendingSteps, { label: pending })] }));
    }
    if (!d) {
        return (_jsxs(Card, { className: "min-w-0 gap-0 rounded-lg py-0", children: [_jsx(Header, { status: status }), _jsx("p", { className: "px-6 py-10 text-muted-foreground", children: "Fire an event to follow it through the pipeline: raw facts, decision, words, channel." })] }));
    }
    const session = d.session;
    const where = session.connection_count === 0 ? 'No tab' : session.visible ? 'Visible' : 'Hidden';
    return (_jsxs(Card, { className: "min-w-0 gap-0 rounded-lg py-0", children: [_jsx(Header, { status: status, deliveryId: d.id }), deliveries.length > 1 && (_jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b px-6 py-3", children: [_jsx("span", { className: "mr-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase", children: "Recent" }), groupRecent(deliveries).slice(0, 8).map((g) => (_jsxs("button", { className: cn('flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-left text-sm shadow-sm transition-shadow hover:shadow-md', g.ids.has(d.id) && 'ring-2 ring-primary'), onClick: () => setSelectedId(g.latest.id), children: [_jsx(Icon, { name: g.priority, size: 16, className: PRIORITY_TEXT[g.priority] }), _jsxs("span", { className: "sr-only", children: [g.priority, " priority:"] }), _jsxs("span", { className: "grid leading-tight", children: [_jsx("span", { className: "font-medium", children: g.label }), _jsx("small", { className: "text-[0.7rem] text-muted-foreground", children: timeOf(g.latest.created_at) })] }), g.count > 1 && (_jsxs(Badge, { variant: "secondary", className: "rounded-full px-1.5 tabular-nums", "aria-label": `fired ${g.count} times`, children: ["\u00D7", g.count] }))] }, g.key)))] })), _jsxs("ol", { className: "px-4 py-6 sm:px-6", children: [_jsx(Step, { n: 1, tone: "info", icon: "code", title: "Event facts", children: _jsx(Panel, { children: _jsx("pre", { className: "max-h-[50vh] overflow-auto font-mono text-sm leading-relaxed break-words whitespace-pre-wrap", children: eventJson(d) }) }) }), _jsxs(Step, { n: 2, tone: "action", icon: "scale", title: "Decision logic", children: [_jsxs("div", { className: "grid gap-2.5 sm:grid-cols-2", children: [_jsx(Stat, { label: "Channel", value: ACTION_LABEL[d.decision.action], tone: ACTION_TEXT[d.decision.action] }), _jsx(Stat, { label: "Inbox placement", value: d.decision.also_inbox ? 'Yes' : 'No', tone: d.decision.also_inbox ? 'text-good' : 'text-muted-foreground' }), _jsx(Stat, { label: "Urgency", value: d.decision.sticky ? 'Critical' : d.decision.urgency, tone: d.decision.sticky || d.decision.urgency === 'high' ? 'text-critical' : 'text-muted-foreground' }), _jsx(Stat, { label: "Customer tab", value: session.view && session.visible ? `${where} · ${session.view}` : where, tone: session.visible ? 'text-good' : 'text-muted-foreground' })] }), _jsx("p", { className: "mt-3 text-sm text-muted-foreground", children: d.decision.reason })] }), _jsx(Step, { n: 3, tone: "primary", icon: "chat", title: d.message ? `Copy generator (${SOURCE_LABEL[d.message.source]})` : 'Copy generator', children: d.message ? (_jsxs(Panel, { children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(NoteIcon, { name: d.message.icon, priority: d.priority, size: "lg" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-semibold", children: d.message.title }), _jsxs("p", { className: "mt-0.5 text-lg leading-snug", children: ["\u201C", d.message.body, "\u201D"] })] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-1.5", children: [_jsxs(Badge, { variant: "secondary", className: "rounded-md", children: ["Locale: ", d.context.locale] }), d.message.latency_ms != null && d.message.source !== 'cache' && (_jsxs(Badge, { variant: "secondary", className: "rounded-md", children: [d.message.latency_ms, " ms"] })), _jsxs(Badge, { variant: "secondary", className: "rounded-md", children: ["Icon: ", d.message.icon] }), _jsxs(Badge, { variant: "secondary", className: "rounded-md", children: ["Context: ", d.context.view, ", ", d.context.visible ? 'visible' : 'away'] }), d.message.fallback_reason && (_jsxs(Badge, { className: "rounded-md bg-action/15 text-action", children: ["Fallback: ", fallbackLabel(d.message.fallback_reason)] }))] })] })) : (_jsx(Panel, { children: _jsx("p", { className: "text-lg font-bold text-good", children: "No words needed. Rules chose not to speak." }) })) }), _jsx(Step, { n: 4, tone: "good", icon: "send", title: "Delivery channels", last: true, children: _jsx("div", { className: "grid gap-2.5", children: d.channels.map((c) => {
                                const failed = FAILED_STATUSES.has(c.status);
                                return (_jsxs(Panel, { className: cn('py-3', failed && 'border-dashed'), children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "font-semibold", children: CHANNEL_LABEL[c.channel] ?? c.channel }), _jsx("span", { className: cn('text-sm font-bold uppercase', failed ? 'text-critical' : c.status === 'skipped' ? 'text-muted-foreground' : 'text-good'), children: c.status.replace(/_/g, ' ') })] }), c.detail && _jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: c.detail })] }, c.channel));
                            }) }) })] })] }));
}
