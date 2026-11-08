import type { ReactNode } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsPanelProps {
  title: string;
  /** The line under the title: what the panel shows and over which period. */
  subtitle?: string | undefined;
  /** A newer answer is on its way while the previous one stays on screen. */
  busy?: boolean | undefined;
  /** What sits at the end of the header, such as the tabs of the allocation. */
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * The card every panel of the Analytics screen sits in, as the Figma draws it: a title with the line
 * that says what it shows, and the content under them. Each panel asks for its own data, so it loads,
 * fails and retries on its own without taking the other panels with it.
 */
export function AnalyticsPanel({ title, subtitle, busy, aside, children }: AnalyticsPanelProps) {
  const titleId = useId();

  return (
    <section
      aria-busy={busy}
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl leading-7 font-medium text-(--color-text-default)" id={titleId}>
            {title}
          </h2>
          {subtitle === undefined ? null : (
            <p className="text-sm text-(--color-text-secondary)">{subtitle}</p>
          )}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The grey block that holds the place of a panel's content, announced once as a loading status. */
export function AnalyticsPanelLoading({ label }: { label: string }) {
  return (
    <div aria-label={label} role="status">
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

interface AnalyticsPanelErrorProps {
  title: string;
  description: string;
  onRetry: () => void;
}

/** What a panel says when its own request failed, with a retry that asks again for that panel only. */
export function AnalyticsPanelError({ title, description, onRetry }: AnalyticsPanelErrorProps) {
  const { t } = useTranslation();

  return (
    <Alert
      action={
        <Button onClick={onRetry} size="sm" variant="outline">
          {t("analytics.failed.retry")}
        </Button>
      }
      description={description}
      title={title}
      tone="error"
    />
  );
}
