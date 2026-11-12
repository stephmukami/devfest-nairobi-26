import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api, getDemoKey, setDemoKey } from '@/lib/api';
import { eventLabel, STATUS_LABEL } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { PRIORITY_TEXT } from '@/lib/priority';
import { cn } from '@/lib/utils';
function describeSession(p) {
    if (!p)
        return 'unknown';
    const s = p.session;
    if (s.connection_count === 0)
        return 'No customer tab open';
    const tabs = `${s.connection_count} tab${s.connection_count > 1 ? 's' : ''}`;
    if (!s.visible)
        return `${tabs} · hidden`;
    return `${tabs} · visible · ${s.view}${s.parcel_id ? ` ${s.parcel_id}` : ''}`;
}
const deviceLabel = (n) => `${n} device${n === 1 ? '' : 's'}`;
const GROUPS = [
    { priority: 'info', title: 'Trigger info events' },
    { priority: 'action', title: 'Action required' },
    { priority: 'critical', title: 'Critical scenarios' },
];
// The last fired event stays highlighted in its priority colour.
const FIRED_BG = {
    info: 'bg-info/10',
    action: 'bg-action/10',
    critical: 'bg-critical/10',
};
function SectionLabel({ children }) {
    return _jsx("h3", { className: "mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase", children: children });
}
const triggerRow = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:cursor-progress disabled:opacity-60';
export function DemoController({ config, userId, onUserChange, parcels, presence, devices, onAfterReset, onDevicesCleared, onFire, onFireFailed, }) {
    const [parcelId, setParcelId] = useState('');
    const [switches, setSwitches] = useState(config.switches);
    const [key, setKey] = useState(getDemoKey());
    const [busy, setBusy] = useState(null);
    const [fired, setFired] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!parcels.some((p) => p.parcel_id === parcelId))
            setParcelId(parcels[0]?.parcel_id ?? '');
    }, [parcels, parcelId]);
    useEffect(() => {
        api.getSettings().then(setSwitches).catch(() => { });
    }, [key]);
    async function run(label, fn) {
        setBusy(label);
        setError(null);
        try {
            await fn();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(null);
        }
    }
    const toggle = (update) => run('settings', async () => setSwitches(await api.putSettings(update)));
    const persona = config.personas.find((p) => p.user_id === userId);
    const parcel = parcels.find((p) => p.parcel_id === parcelId);
    const switchRows = [
        {
            id: 'sw-gemini',
            checked: switches.enrich_mode === 'gemini',
            onChange: (v) => toggle({ enrich_mode: v ? 'gemini' : 'template' }),
            label: (_jsxs(_Fragment, { children: ["Gemini enrichment", !config.gemini_configured && _jsx("em", { className: "block font-normal text-muted-foreground", children: "No API key, templates only" })] })),
        },
        {
            id: 'sw-outage',
            checked: switches.simulate_gemini_failure,
            onChange: (v) => toggle({ simulate_gemini_failure: v }),
            label: 'Simulate Gemini outage',
        },
        {
            id: 'sw-coalesce',
            checked: switches.coalesce,
            onChange: (v) => toggle({ coalesce: v }),
            label: 'Coalesce bursts (2 s window)',
        },
    ];
    return (_jsxs("div", { className: "grid gap-6 p-5", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("span", { className: "grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground", children: _jsx(Icon, { name: "truck", size: 22 }) }), _jsx("span", { className: "text-xl font-extrabold tracking-tight", children: "SHIPPY" }), _jsx(Badge, { variant: "secondary", className: "ml-auto rounded-md font-mono text-[0.65rem] tracking-wider", children: "STAGE" })] }), _jsxs("section", { children: [_jsx(SectionLabel, { children: "Customer context" }), _jsxs(Select, { value: userId, onValueChange: onUserChange, children: [_jsx(SelectTrigger, { className: "w-full rounded-lg bg-muted/50 py-2.5 data-[size=default]:h-auto", "aria-label": "Customer", children: _jsxs("span", { className: "flex min-w-0 items-center gap-2.5", children: [_jsx("span", { className: "grid size-8 flex-none place-items-center rounded-full bg-action/15 text-sm font-bold text-action", children: persona?.name.charAt(0) }), _jsx("span", { className: "truncate text-left font-semibold", children: persona?.name })] }) }), _jsx(SelectContent, { position: "popper", className: "w-(--radix-select-trigger-width)", children: config.personas.map((p) => (_jsxs(SelectItem, { value: p.user_id, children: [p.name, devices && (_jsxs("span", { className: cn('text-xs', devices[p.user_id] ? 'text-good' : 'text-muted-foreground'), children: ["\u00B7 ", deviceLabel(devices[p.user_id] ?? 0)] }))] }, p.user_id))) })] }), _jsxs("p", { className: "mt-2 flex items-center gap-2 px-1 text-xs text-muted-foreground", children: [_jsx("span", { className: cn('size-2 rounded-full', presence?.session.visible ? 'bg-good' : 'bg-muted-foreground') }), describeSession(presence)] }), devices && (_jsxs("p", { className: "mt-1 flex items-center gap-2 px-1 text-xs text-muted-foreground", children: [_jsx(Icon, { name: "bell", size: 12, className: devices[userId] ? 'text-good' : 'text-action' }), devices[userId]
                                ? `Push reaches ${deviceLabel(devices[userId])}`
                                : 'No device has alerts on for this customer: pushes go nowhere'] }))] }), _jsxs("section", { children: [_jsx(SectionLabel, { children: "Parcel context" }), _jsxs(Select, { value: parcelId, onValueChange: setParcelId, disabled: parcels.length === 0, children: [_jsx(SelectTrigger, { className: "w-full rounded-lg bg-muted/50 py-2.5 data-[size=default]:h-auto", "aria-label": "Parcel", children: _jsxs("span", { className: "flex min-w-0 items-center gap-2.5", children: [_jsx("span", { className: "grid size-8 flex-none place-items-center text-primary", children: _jsx(Icon, { name: "package", size: 22 }) }), _jsxs("span", { className: "grid min-w-0 text-left", children: [_jsx("span", { className: "truncate font-semibold", children: parcel?.parcel_id ?? 'No parcels' }), parcel && (_jsxs("span", { className: "truncate text-xs text-primary", children: [parcel.item, " \u00B7 ", STATUS_LABEL[parcel.status] ?? parcel.status] }))] })] }) }), _jsx(SelectContent, { position: "popper", className: "w-(--radix-select-trigger-width)", children: parcels.map((p) => (_jsxs(SelectItem, { value: p.parcel_id, children: [p.parcel_id, " \u00B7 ", p.item, " (", STATUS_LABEL[p.status] ?? p.status, ")"] }, p.parcel_id))) })] })] }), GROUPS.map(({ priority, title }) => (_jsxs("section", { children: [_jsx(SectionLabel, { children: title }), _jsx("ul", { className: "grid gap-0.5", children: config.catalogue
                            .filter((c) => c.priority === priority)
                            .map((t) => (_jsx("li", { children: _jsxs("button", { className: cn(triggerRow, fired === t.type && [FIRED_BG[priority], PRIORITY_TEXT[priority]]), title: `${t.type}: ${t.meaning}`, disabled: busy !== null, onClick: () => run(t.type, async () => {
                                    onFire?.(eventLabel(t.type));
                                    try {
                                        await api.emit(userId, t.type, parcelId || undefined);
                                    }
                                    catch (e) {
                                        onFireFailed?.();
                                        throw e;
                                    }
                                    setFired(t.type);
                                }), children: [_jsx(Icon, { name: priority, size: 16, className: PRIORITY_TEXT[priority] }), eventLabel(t.type)] }) }, t.type))) })] }, priority))), _jsxs("section", { children: [_jsx(SectionLabel, { children: "Scenarios" }), _jsxs("button", { className: cn(triggerRow, fired === 'burst' && 'bg-muted'), disabled: busy !== null, onClick: () => run('burst', async () => {
                            onFire?.('Burst: 3 events');
                            try {
                                await api.burst(userId);
                            }
                            catch (e) {
                                onFireFailed?.();
                                throw e;
                            }
                            setFired('burst');
                        }), children: [_jsx(Icon, { name: "flash", size: 16, className: "text-primary" }), "Burst: 3 events at once"] })] }), _jsxs("section", { className: "grid gap-3", children: [_jsx(SectionLabel, { children: "Kill switches" }), switchRows.map((s) => (_jsxs("div", { className: "flex items-start gap-2.5", children: [_jsx(Switch, { id: s.id, checked: s.checked, onCheckedChange: s.onChange, className: "mt-0.5" }), _jsx(Label, { htmlFor: s.id, className: "block font-normal", children: s.label })] }, s.id)))] }), _jsxs("section", { className: "grid gap-3", children: [config.demo_key_required && (_jsxs("div", { className: "grid gap-1.5", children: [_jsx(Label, { htmlFor: "dc-key", className: "text-xs text-muted-foreground", children: "Demo key" }), _jsx(Input, { id: "dc-key", type: "password", value: key, onChange: (e) => {
                                    setKey(e.target.value);
                                    setDemoKey(e.target.value);
                                } })] })), _jsx(Button, { variant: "outline", className: "border-dashed text-muted-foreground", disabled: busy !== null, onClick: () => run('reset', async () => {
                            await api.reset();
                            setFired(null);
                            onAfterReset();
                        }), children: "Reset demo data" }), _jsxs(Button, { variant: "outline", className: "border-dashed text-muted-foreground", disabled: busy !== null, title: "Forget every device with alerts on. Phones that still allow alerts sign up again the next time Shippy opens.", onClick: () => run('clear devices', async () => {
                            await api.clearDevices();
                            onDevicesCleared?.();
                        }), children: [_jsx(Icon, { name: "bellOff", size: 16 }), " Clear devices"] }), busy && _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Sending ", busy, "\u2026"] }), error && _jsx("p", { className: "text-sm text-destructive", children: error })] })] }));
}
