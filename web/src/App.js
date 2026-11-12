import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { AppSkeleton } from './components/LoadingSkeletons';
import { api } from './lib/api';
import { useRoute } from './lib/route';
import { load, save } from './lib/storage';
import { CustomerApp } from './pages/CustomerApp';
import { StagePage } from './pages/StagePage';
const USER_KEY = 'shippy.user';
export default function App() {
    const route = useRoute();
    const [config, setConfig] = useState(null);
    const [error, setError] = useState(null);
    const [userId, setUserId] = useState(() => load(USER_KEY, 'u_amani'));
    useEffect(() => {
        api.config().then(setConfig).catch((e) => setError(String(e)));
    }, []);
    // Keep the stage window and the customer window on the same persona.
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === USER_KEY && e.newValue)
                setUserId(e.newValue);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    const changeUser = (id) => {
        save(USER_KEY, id);
        setUserId(id);
    };
    if (error)
        return _jsxs("p", { className: "p-8 text-destructive", children: ["Could not reach the Shippy API: ", error] });
    if (!config)
        return _jsx(AppSkeleton, { stage: route.name === 'stage' });
    const validUser = config.personas.some((p) => p.user_id === userId) ? userId : config.personas[0].user_id;
    return route.name === 'stage' ? (_jsx(StagePage, { config: config, userId: validUser, onUserChange: changeUser })) : (_jsx(CustomerApp, { route: route, config: config, userId: validUser, onUserChange: changeUser }));
}
