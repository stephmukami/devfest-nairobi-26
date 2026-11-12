import { jsxs as _jsxs, Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { NoteIcon } from './NoteIcon';
const DURATION_MS = 8000;
// Outer tinted frame and footer accent per priority (info is the neutral "heads up" style).
const FRAME = {
    info: 'bg-muted border-border',
    action: 'bg-action/10 border-action/30',
    critical: 'bg-critical/10 border-critical/30',
};
const ACCENT = {
    info: 'text-foreground',
    action: 'text-action',
    critical: 'text-critical',
};
/** "This message will disappear in 7sec", paused while the pointer is over the toast (Sonner pauses too). */
function Countdown({ paused, priority }) {
    const [left, setLeft] = useState(Math.round(DURATION_MS / 1000));
    useEffect(() => {
        if (paused)
            return;
        const t = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
        return () => window.clearInterval(t);
    }, [paused]);
    return (_jsxs(_Fragment, { children: ["This message will disappear in ", _jsxs("span", { className: cn('font-semibold', ACCENT[priority]), children: [left, "sec"] })] }));
}
function ToastCard({ t, id, onOpen }) {
    const [hover, setHover] = useState(false);
    const close = () => toast.dismiss(id);
    return (_jsxs("div", { role: t.priority === 'critical' ? 'alert' : 'status', onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false), className: cn('w-[min(400px,calc(100vw-32px))] rounded-lg border p-1.5', FRAME[t.priority]), children: [_jsxs("div", { className: "flex flex-wrap items-start gap-3 rounded-lg bg-card p-3 text-card-foreground shadow-sm", children: [_jsx(NoteIcon, { name: t.icon, priority: t.priority }), _jsxs("button", { className: "grid min-w-40 flex-1 gap-0.5 text-left text-sm", onClick: () => {
                            close();
                            onOpen(t);
                        }, children: [_jsx("strong", { className: "font-semibold", children: t.title }), _jsx("span", { className: "text-muted-foreground", children: t.body })] }), _jsxs("div", { className: "ml-auto flex flex-none items-center gap-1", children: [t.cta && (_jsx(Button, { variant: "outline", size: "sm", onClick: () => {
                                    close();
                                    t.cta.run();
                                }, children: t.cta.label })), t.parcelId && (_jsx(Button, { variant: "secondary", size: "sm", onClick: () => {
                                    close();
                                    onOpen(t);
                                }, children: "View" })), _jsx(Button, { variant: "ghost", size: "icon-sm", className: "text-muted-foreground", "aria-label": "Dismiss", onClick: close, children: _jsx(Icon, { name: "close", size: 16 }) })] })] }), _jsx("p", { className: "px-3 pt-1.5 pb-1 text-center text-xs text-muted-foreground", children: t.sticky ? (_jsxs(_Fragment, { children: [_jsx("span", { className: cn('font-semibold', ACCENT[t.priority]), children: "Needs action." }), " This stays until you open or dismiss it."] })) : (_jsx(Countdown, { paused: hover, priority: t.priority })) })] }));
}
/** Show (or replace, same id) a notification toast through Sonner. Sticky ones stay until dismissed or opened. */
export function showToast(t, onOpen) {
    toast.custom((id) => _jsx(ToastCard, { t: t, id: id, onOpen: onOpen }), {
        id: t.id,
        duration: t.sticky ? Infinity : DURATION_MS,
    });
}
export const clearToasts = () => toast.dismiss();
