import { jsx as _jsx } from "react/jsx-runtime";
import { Toaster as Sonner } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, InformationCircleIcon, Alert02Icon, MultiplicationSignCircleIcon, Loading03Icon } from "@hugeicons/core-free-icons";
// The app follows the OS colour scheme, so Sonner does too (no next-themes provider).
const Toaster = ({ ...props }) => {
    return (_jsx(Sonner, { theme: "system", className: "toaster group", icons: {
            success: (_jsx(HugeiconsIcon, { icon: CheckmarkCircle02Icon, strokeWidth: 2, className: "size-4" })),
            info: (_jsx(HugeiconsIcon, { icon: InformationCircleIcon, strokeWidth: 2, className: "size-4" })),
            warning: (_jsx(HugeiconsIcon, { icon: Alert02Icon, strokeWidth: 2, className: "size-4" })),
            error: (_jsx(HugeiconsIcon, { icon: MultiplicationSignCircleIcon, strokeWidth: 2, className: "size-4" })),
            loading: (_jsx(HugeiconsIcon, { icon: Loading03Icon, strokeWidth: 2, className: "size-4 animate-spin" })),
        }, style: {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
            "--border-radius": "var(--radius)",
        }, toastOptions: {
            classNames: {
                toast: "cn-toast",
            },
        }, ...props }));
};
export { Toaster };
