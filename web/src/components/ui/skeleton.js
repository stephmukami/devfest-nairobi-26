import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
function Skeleton({ className, ...props }) {
    return (_jsx("div", { "data-slot": "skeleton", 
        // A shade darker than bg-muted, which nearly disappears on the near-white page background.
        className: cn("animate-pulse rounded-md bg-foreground/[0.07]", className), ...props }));
}
export { Skeleton };
