import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { ChannelInspector } from '@/components/ChannelInspector';
import { DemoController } from '@/components/DemoController';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Icon } from '@/lib/icons';
import { useStream } from '@/lib/sse';
import { tabClientId } from '@/lib/storage';
const clientId = tabClientId();
/** Presenter view. Observes the stream without counting as the customer's presence,
 *  so hiding the customer tab (or locking the phone) still shows here. */
export function StagePage({ config, userId, onUserChange }) {
    const [deliveries, setDeliveries] = useState([]);
    const [presence, setPresence] = useState(null);
    const [parcels, setParcels] = useState([]);
    // Label of an event fired from the controller whose delivery has not arrived yet.
    const [pending, setPending] = useState(null);
    // A pending event belongs to the previous customer's stream, which we stop watching.
    useEffect(() => setPending(null), [userId]);
    // Safety net: never leave the inspector in its loading state if a delivery never comes.
    useEffect(() => {
        if (!pending)
            return;
        const timer = window.setTimeout(() => setPending(null), 15000);
        return () => window.clearTimeout(timer);
    }, [pending]);
    const load = useCallback(() => {
        api.deliveries(userId).then((ds) => setDeliveries([...ds].reverse())).catch(() => setDeliveries([]));
        api.parcels(userId).then(setParcels).catch(() => { });
        api.presence(userId).then(setPresence).catch(() => { });
    }, [userId]);
    useEffect(load, [load]);
    const onDelivery = useCallback((d) => {
        setPending(null);
        setDeliveries((ds) => [d, ...ds.filter((x) => x.id !== d.id)].slice(0, 50));
        if (d.parcels.length)
            setParcels((ps) => ps.map((p) => d.parcels.find((u) => u.parcel_id === p.parcel_id) ?? p));
    }, []);
    const status = useStream({ userId, clientId, observer: true, onDelivery, onPresence: setPresence });
    // Which persona each phone receives pushes for. Registration follows a tab connecting (a presence
    // update), so refresh shortly after each one, plus a slow poll for tabs of other personas.
    const [devices, setDevices] = useState(null);
    const loadDevices = useCallback(() => {
        api.devices().then(setDevices).catch(() => { });
    }, []);
    useEffect(() => {
        loadDevices();
        const poll = window.setInterval(loadDevices, 10000);
        return () => window.clearInterval(poll);
    }, [loadDevices]);
    useEffect(() => {
        const t = window.setTimeout(loadDevices, 1500);
        return () => window.clearTimeout(t);
    }, [presence, userId, loadDevices]);
    return (
    // Desktop: full-height sidebar + scrolling main. Below 1024px the sidebar stacks on top.
    _jsxs("div", { className: "min-h-dvh lg:grid lg:h-dvh lg:grid-cols-[300px_minmax(0,1fr)]", children: [_jsx("aside", { className: "border-b bg-card lg:overflow-y-auto lg:border-r lg:border-b-0", children: _jsx(DemoController, { config: config, userId: userId, onUserChange: onUserChange, parcels: parcels, presence: presence, devices: devices, onAfterReset: load, onDevicesCleared: loadDevices, onFire: setPending, onFireFailed: () => setPending(null) }) }), _jsxs("main", { className: "min-w-0 px-4 py-6 sm:px-8 lg:overflow-y-auto", children: [_jsxs("header", { className: "mx-auto mb-6 flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2", children: [_jsx("h1", { className: "text-2xl font-bold tracking-tight sm:text-3xl", children: "Signals over noise" }), _jsx(Button, { variant: "outline", asChild: true, className: "ml-auto", children: _jsxs("a", { href: "/", target: "_blank", rel: "noreferrer", children: ["Open customer app ", _jsx(Icon, { name: "external", size: 16 })] }) })] }), _jsx("div", { className: "mx-auto max-w-5xl", children: _jsx(ChannelInspector, { deliveries: deliveries, status: status, pending: pending }) })] })] }));
}
