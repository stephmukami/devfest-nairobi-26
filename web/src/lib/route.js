import { useEffect, useState } from 'react';
export function parse(path) {
    const parcel = path.match(/^\/parcels\/(SHP-\d{5})\/?$/);
    if (parcel)
        return { name: 'parcel', parcelId: parcel[1] };
    if (path.startsWith('/orders'))
        return { name: 'orders' };
    if (path.startsWith('/payment'))
        return { name: 'payment' };
    if (path.startsWith('/stage'))
        return { name: 'stage' };
    return { name: 'home' };
}
export function routeView(route) {
    switch (route.name) {
        case 'orders':
            return 'orders_list';
        case 'parcel':
            return 'parcel_detail';
        case 'payment':
            return 'payment';
        default:
            return 'home';
    }
}
export function navigate(path) {
    if (path === window.location.pathname)
        return;
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
}
export function useRoute() {
    const [route, setRoute] = useState(() => parse(window.location.pathname));
    useEffect(() => {
        const onPop = () => setRoute(parse(window.location.pathname));
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
    return route;
}
