import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { STATUS_ICON } from '@/lib/format';
import { Icon, NotificationIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
// Product photos made from the JPGs in public/: 256px squares in public/items for lists,
// up to 1200px in public/items/large for the pop-out. An item missing here shows its status icon.
const ITEM_IMAGE = {
    'Woven basket': 'basket',
    'Bluetooth speaker': 'bluetooth-speaker',
    'Football boots': 'football-boots',
    'Bedsheet set': 'bedsheets',
    Blender: 'blender',
    'Coffee beans': 'coffee-beans',
    Cookbook: 'cookbook',
    'Linen shirt': 'linen-shirt',
    'Phone case': 'phone-case',
    'Running shoes': 'running-shoes',
    'Spice set': 'spice-rack',
    Storybook: 'storybook',
    'Table lamp': 'table-lamp',
};
const SIZES = {
    sm: { box: 'size-11', icon: 22 },
    lg: { box: 'size-16 sm:size-20', icon: 30 },
};
/**
 * Product photo (or status icon). Clicking a photo opens it large.
 * Inside a clickable card, give the card's own button a stretched overlay and leave this above it
 * (it is `relative z-10`), so the photo and the card are separate buttons.
 */
export function ParcelThumb({ parcel, size = 'sm', className }) {
    const s = SIZES[size];
    const image = ITEM_IMAGE[parcel.item];
    if (!image) {
        return (_jsx("span", { className: cn('grid flex-none place-items-center rounded-lg border bg-muted/50 text-foreground/80', s.box, className), children: _jsx(NotificationIcon, { name: STATUS_ICON[parcel.status] ?? 'package', size: s.icon }) }));
    }
    return (_jsxs(Dialog, { children: [_jsx(DialogTrigger, { asChild: true, children: _jsx("button", { className: cn('relative z-10 flex-none cursor-zoom-in overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none', s.box, className), "aria-label": `View photo of ${parcel.item}`, children: _jsx("img", { src: `/items/${image}.webp`, alt: "", loading: "lazy", className: "size-full object-cover" }) }) }), _jsxs(DialogContent, { showCloseButton: false, className: "w-[calc(100vw-2rem)] max-w-none gap-3 rounded-lg p-3 sm:w-auto sm:max-w-[min(90vw,56rem)]", children: [_jsxs("div", { className: "relative", children: [_jsx("img", { src: `/items/large/${image}.webp`, alt: parcel.item, className: "mx-auto max-h-[75vh] w-full rounded-md bg-muted object-contain sm:w-auto" }), _jsx(DialogClose, { asChild: true, children: _jsx(Button, { variant: "secondary", size: "icon-sm", className: "absolute top-2 right-2 rounded-full bg-card/90 shadow-md hover:bg-card", "aria-label": "Close", children: _jsx(Icon, { name: "close", size: 16 }) }) })] }), _jsxs("div", { className: "px-1 pb-1", children: [_jsx(DialogTitle, { className: "font-semibold", children: parcel.item }), _jsxs(DialogDescription, { children: [parcel.store, " \u00B7 ", parcel.parcel_id] })] })] })] }));
}
