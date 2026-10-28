import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { StatusDot } from "@/components/status-dot";
import { cn } from "@/lib/utils";

interface StatusItemProps extends Omit<ComponentProps<"span">, "children"> {
  tone?: ComponentProps<typeof StatusDot>["tone"];
  icon?: LucideIcon;
  children: ReactNode;
}

/** One read-only datum of the status bar: an optional dot or icon and a label. */
export function StatusItem({ tone, icon: Icon, children, className, ...props }: StatusItemProps) {
  return (
    <span
      className={cn("flex items-center gap-2 px-1 py-0.5 text-xs text-muted-foreground", className)}
      {...props}
    >
      {tone ? <StatusDot tone={tone} /> : null}
      {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
      <span>{children}</span>
    </span>
  );
}
