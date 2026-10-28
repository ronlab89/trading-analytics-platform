import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}

/** Icon-only button of the activity bar; the tooltip carries the name sighted users do not see. */
export function NavItem({ to, label, icon: Icon, active }: NavItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          aria-current={active ? "page" : undefined}
          aria-label={label}
          className={cn(
            "flex size-10 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            active
              ? "bg-(--color-nav-item-background-active) text-(--color-nav-item-foreground-active)"
              : "text-(--color-nav-item-foreground) hover:bg-(--color-nav-item-background-hover) hover:text-(--color-nav-item-foreground-hover)",
          )}
          to={to}
        >
          <Icon aria-hidden="true" className="size-6" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={2}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
