import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnDot } from '@/components/ConnDot';
import { HomeDashboard } from '@/components/HomeDashboard';
import { Inbox } from '@/components/Inbox';
import { HomeSkeleton, OrdersSkeleton } from '@/components/LoadingSkeletons';
import { ParcelList } from '@/components/ParcelList';
import { ParcelThumb } from '@/components/ParcelThumb';
import { ParcelTimeline } from '@/components/ParcelTimeline';
import { clearToasts, showToast } from '@/components/Toasts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Toaster } from '@/components/ui/sonner';
import { api } from '@/lib/api';
import { recordAction, usePresence } from '@/lib/context';
import { SettingsSheet } from '@/components/SettingsSheet';
import { currentAlertsState, disableAlerts, enableAlerts, listenForeground, listenWorkerNavigation, syncAppBadge, } from '@/lib/fcm';
import { Icon } from '@/lib/icons';
import { openParcel, parcelCta } from '@/lib/parcelActions';
import { navigate, routeView } from '@/lib/route';
import { useStream } from '@/lib/sse';
import { tabClientId } from '@/lib/storage';
import { cn } from '@/lib/utils';
const clientId = tabClientId();
const TABS = [
    { label: 'Home', to: '/', icon: 'home', match: ['home'] },
    { label: 'Orders', to: '/orders', icon: 'package', match: ['orders', 'parcel'] },
    { label: 'Payments', to: '/payment', icon: 'payments', match: ['payment'] },
];
function openFromToast(t) {
    if (t.parcelId)
        openParcel(t.parcelId);
}
// The banner is only for a device that has never been asked (or an iPhone that has to install
// Shippy first). After that, alerts are switched on and off in Settings.
const BANNER_STATES = new Set(['default', 'ios_install']);
export function CustomerApp({ route, config, userId, onUserChange }) {
    const persona = config.personas.find((p) => p.user_id === userId) ?? config.personas[0];
    const [parcels, setParcels] = useState([]);
    // False until the current customer's parcels arrive, so lists show skeletons, not "No parcels".
    const [parcelsLoaded, setParcelsLoaded] = useState(false);
    const [inbox, setInbox] = useState([]);
    const [flashId, setFlashId] = useState(null);
    const [alerts, setAlerts] = useState('default');
    // Latest parcels for the FCM foreground listener, which is registered once.
    const parcelsRef = useRef(parcels);
    parcelsRef.current = parcels;
    const parcelId = route.name === 'parcel' ? route.parcelId : null;
    usePresence(userId, clientId, routeView(route), parcelId, persona.locale);
    const reload = useCallback(() => {
        setParcelsLoaded(false);
        api
            .parcels(userId)
            .then(setParcels)
            .catch(() => { })
            .finally(() => setParcelsLoaded(true));
        api.inbox(userId).then(setInbox).catch(() => { });
    }, [userId]);
    useEffect(() => {
        clearToasts();
        reload();
    }, [reload]);
    // Re-register the FCM token on every load: keeps it fresh (and recreates it if the server lost it).
    useEffect(() => {
        void currentAlertsState().then((state) => {
            setAlerts(state);
            if (state === 'granted')
                void enableAlerts(userId, false).then(setAlerts);
        });
    }, [userId]);
    useEffect(() => listenWorkerNavigation(navigate), []);
    // App icon badge (installed app): mirror the inbox, so reading it clears the red dot.
    const unread = inbox.filter((i) => !i.read).length;
    useEffect(() => syncAppBadge(unread), [unread]);
    useEffect(() => listenForeground((p) => showToast({
        id: p.eventId,
        title: p.title,
        body: p.body,
        icon: p.icon,
        priority: p.priority,
        sticky: p.priority === 'critical',
        parcelId: p.parcelId,
        cta: parcelCta(parcelsRef.current.find((x) => x.parcel_id === p.parcelId)),
        via: 'fcm',
    }, openFromToast)), []);
    const onDelivery = useCallback((d, fresh) => {
        if (d.parcels.length) {
            setParcels((ps) => ps.map((p) => d.parcels.find((u) => u.parcel_id === p.parcel_id) ?? p));
        }
        if (d.inbox_item) {
            const item = d.inbox_item;
            setInbox((items) => (items.some((i) => i.event_id === item.event_id) ? items : [item, ...items]));
        }
        if (d.decision.action === 'inline') {
            setFlashId(d.events[d.events.length - 1].event_id);
        }
        if (fresh && d.decision.action === 'toast' && d.message) {
            const toastParcelId = (d.events.length === 1 ? d.events[0].payload.parcel_id : null) ?? null;
            showToast({
                id: d.id,
                title: d.message.title,
                body: d.message.body,
                icon: d.message.icon,
                priority: d.priority,
                sticky: d.decision.sticky,
                parcelId: toastParcelId,
                // The delivery carries the parcel as it is after this event.
                cta: parcelCta(d.parcels.find((x) => x.parcel_id === toastParcelId)),
                via: 'sse',
            }, openFromToast);
        }
        // 'push' is delivered by FCM; 'inbox_only' just bumps the badge via inbox_item.
    }, []);
    const status = useStream({ userId, clientId, onDelivery });
    // Locally the API keeps FCM tokens in memory, so a restart (including every --reload) forgets them,
    // and a tab that stays open would never re-register. Re-register each time the live stream
    // (re)connects, which is exactly when the API has come back. Registering twice is harmless.
    useEffect(() => {
        if (status === 'open' && alerts === 'granted')
            void enableAlerts(userId, false);
    }, [status, alerts, userId]);
    const markRead = () => {
        void api.markInboxRead(userId).catch(() => { });
        setInbox((items) => items.map((i) => ({ ...i, read: true })));
    };
    const parcel = parcels.find((p) => p.parcel_id === parcelId);
    const due = parcels.filter((p) => p.status === 'payment_due');
    const container = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10';
    const split = route.name === 'orders' || route.name === 'parcel';
    return (_jsxs("div", { className: "flex min-h-dvh flex-col bg-background", children: [_jsx("header", { className: "sticky top-0 z-20 border-b bg-card/95 backdrop-blur", children: _jsxs("div", { className: cn(container, 'flex h-14 items-center gap-2 sm:gap-4'), children: [_jsxs("button", { className: "flex items-center gap-2 text-lg font-extrabold", onClick: () => navigate('/'), children: [_jsx("img", { src: "/icon.svg", alt: "", width: 28, height: 28 }), " ", _jsx("span", { className: "hidden sm:inline", children: "Shippy" })] }), _jsxs("nav", { className: "ml-6 hidden gap-1 sm:flex", children: [_jsx(Button, { variant: route.name === 'home' ? 'secondary' : 'ghost', onClick: () => navigate('/'), children: "Home" }), _jsx(Button, { variant: split ? 'secondary' : 'ghost', onClick: () => navigate('/orders'), children: "Orders" }), _jsx(Button, { variant: route.name === 'payment' ? 'secondary' : 'ghost', onClick: () => navigate('/payment'), children: "Payments" })] }), _jsxs("div", { className: "ml-auto flex items-center gap-2 sm:gap-3", children: [_jsx(ConnDot, { status: status, label: "Live updates" }), _jsx(Inbox, { items: inbox, parcels: parcels, onMarkAllRead: markRead, onOpenItem: (i) => i.parcel_id && openParcel(i.parcel_id) }), _jsx(SettingsSheet, { personaName: persona.name, alerts: alerts, onEnable: async () => setAlerts(await enableAlerts(userId, true)), onDisable: async () => setAlerts(await disableAlerts()) }), _jsxs(Select, { value: userId, onValueChange: onUserChange, children: [_jsxs(SelectTrigger, { className: "gap-2 border-0 bg-transparent px-1.5 shadow-none", "aria-label": "Customer", children: [_jsx("span", { className: "grid size-8 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary", children: persona.name.charAt(0) }), _jsx("span", { className: "hidden font-medium md:inline", children: persona.name })] }), _jsx(SelectContent, { position: "popper", align: "end", children: config.personas.map((p) => (_jsx(SelectItem, { value: p.user_id, children: p.name }, p.user_id))) })] })] })] }) }), BANNER_STATES.has(alerts) && (_jsx("div", { className: "border-b bg-muted", children: _jsx("div", { className: cn(container, 'flex flex-wrap items-center gap-3 py-2 text-sm'), children: alerts === 'ios_install' ? (_jsx("span", { className: "text-muted-foreground", children: "For alerts on iPhone: open in Safari, Share \u2192 Add to Home Screen, then open Shippy from the icon" })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "text-muted-foreground", children: "Get delivery updates even when this tab is closed." }), _jsx(Button, { size: "sm", onClick: () => void enableAlerts(userId, true).then(setAlerts), children: "Enable alerts" })] })) }) })), _jsxs("main", { className: cn(container, 'flex-1 pt-6 pb-24 lg:pt-8'), children: [route.name === 'home' &&
                        (parcelsLoaded ? (_jsx(HomeDashboard, { persona: persona, parcels: parcels, onOpenParcel: openParcel })) : (_jsx(HomeSkeleton, {}))), split && (
                    // Desktop: list and detail side by side. Phone: one at a time (the route decides which).
                    _jsxs("div", { className: "grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]", children: [_jsx("div", { className: cn(route.name === 'parcel' && 'hidden lg:block', 'lg:sticky lg:top-20'), children: parcelsLoaded ? (_jsx(ParcelList, { parcels: parcels, onOpen: openParcel, selectedId: parcelId })) : (_jsx(OrdersSkeleton, {})) }), _jsx("div", { className: cn(route.name === 'orders' && 'hidden lg:block'), children: route.name === 'parcel' ? (_jsx("div", { className: "rounded-lg bg-card p-4 ring-1 ring-foreground/10 sm:p-6", children: _jsx(ParcelTimeline, { parcel: parcel, flashId: flashId, onBack: () => navigate('/orders') }) })) : (_jsx("div", { className: "grid min-h-64 place-items-center rounded-lg border border-dashed p-8 text-center text-muted-foreground", children: "Select a parcel to see its timeline." })) })] })), route.name === 'payment' && (_jsxs("section", { className: "max-w-2xl", children: [_jsx("h1", { className: "text-2xl font-bold tracking-tight", children: "Payments" }), due.length === 0 && _jsx("p", { className: "mt-1 text-muted-foreground", children: "No delivery fees due." }), _jsx("div", { className: "mt-4 grid gap-3", children: due.map((p) => (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4 rounded-lg bg-card px-4 py-3.5 ring-1 ring-foreground/10", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [_jsx(ParcelThumb, { parcel: p }), _jsxs("div", { className: "grid min-w-0", children: [_jsx("strong", { className: "truncate font-semibold", children: p.item }), _jsxs("span", { className: "truncate text-sm text-muted-foreground", children: [p.store, " \u00B7 ", p.parcel_id] })] })] }), _jsxs(Button, { size: "lg", onClick: () => recordAction('tapped:pay_fee'), children: ["Pay KES ", p.fee_kes] })] }, p.parcel_id))) })] }))] }), _jsx("nav", { className: "fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden", "aria-label": "Main", children: TABS.map((t) => {
                    const active = t.match.includes(route.name);
                    return (_jsxs("button", { className: cn('flex flex-col items-center gap-0.5 py-2 text-xs font-medium', active ? 'text-foreground' : 'text-muted-foreground'), "aria-current": active ? 'page' : undefined, onClick: () => navigate(t.to), children: [_jsx(Icon, { name: t.icon, size: 22 }), t.label] }, t.label));
                }) }), _jsx(Toaster, { position: "bottom-right", visibleToasts: 4 })] }));
}
