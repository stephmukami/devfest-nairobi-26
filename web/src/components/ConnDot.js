import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
const TONE = {
    open: 'bg-good',
    connecting: 'bg-action',
    closed: 'bg-critical',
};
export function ConnDot({ status, label }) {
    return _jsx("span", { className: cn('size-2.5 flex-none rounded-full', TONE[status]), title: `${label}: ${status}` });
}
