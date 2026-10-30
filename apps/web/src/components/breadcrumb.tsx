import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "cn";

/** The Figma "Breadcrumb": the route to the current page, the last item being the page itself. */
export function Breadcrumb({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-2">{children}</ol>
    </nav>
  );
}

interface BreadcrumbItemProps {
  /** Present on every item but the current one. */
  to?: string | undefined;
  children: ReactNode;
}

const itemClasses =
  "rounded-md text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function BreadcrumbItem({ to, children }: BreadcrumbItemProps) {
  return (
    <li className="flex items-center gap-2">
      {to ? (
        <Link className={cn(itemClasses, "text-muted-foreground hover:text-foreground")} to={to}>
          {children}
        </Link>
      ) : (
        <span aria-current="page" className={cn(itemClasses, "font-medium text-foreground")}>
          {children}
        </span>
      )}
    </li>
  );
}
