import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface PortfoliosEmptyStateProps {
  title: string;
  description: string;
  /** What the user can do about it, a `Button` for example. */
  action?: ReactNode;
}

/** The Figma "Vacío" and "Sin resultados" block: an icon, what happened and, if any, the way out. */
export function PortfoliosEmptyState({ title, description, action }: PortfoliosEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="mb-1 flex size-12 items-center justify-center rounded-full bg-(--color-surface-secondary) text-(--color-text-secondary)"
      >
        <Inbox className="size-5" />
      </span>
      <h2 className="text-sm font-medium text-(--color-text-default)">{title}</h2>
      <p className="max-w-80 text-sm text-(--color-text-secondary)">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
