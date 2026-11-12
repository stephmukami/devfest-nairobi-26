import { jsx as _jsx } from "react/jsx-runtime";
import { NotificationIcon } from '@/lib/icons';
import { PRIORITY_TEXT } from '@/lib/priority';
import { cn } from '@/lib/utils';
const SIZES = {
    sm: { box: 'size-8', icon: 18 },
    md: { box: 'size-9', icon: 20 },
    lg: { box: 'size-12', icon: 26 },
};
/** Notification icon on a tinted circle, shared by toasts, the inbox and the inspector preview. */
export function NoteIcon({ name, priority, size = 'md', className, }) {
    const s = SIZES[size];
    return (_jsx("span", { className: cn('grid flex-none place-items-center rounded-full bg-current/15', s.box, priority ? PRIORITY_TEXT[priority] : 'text-primary', className), children: _jsx(NotificationIcon, { name: name, size: s.icon }) }));
}
