import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiTone = "gain" | "loss" | "neutral";

interface AnalyticsKpiCardProps {
  label: string;
  /** The figure, or a dash while it is not known. */
  value: ReactNode;
  /** The line under the figure. */
  note: string;
  tone?: KpiTone;
  /** Holds the place of the figure while it loads. */
  loading?: boolean;
}

/**
 * One indicator of the Figma "Análisis": a small card with its name, a large figure and a line that
 * says what the figure is about. The figure is green or red when it is a gain or a loss, and the
 * caller adds the ▲ or ▼ so that is not told by color alone.
 */
export function AnalyticsKpiCard({
  label,
  value,
  note,
  tone = "neutral",
  loading = false,
}: AnalyticsKpiCardProps) {
  return (
    <section
      aria-label={label}
      className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6"
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-(--color-text-secondary)">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-24" />
        ) : (
          <p
            className={cn(
              "flex items-center gap-1 text-xl leading-7 font-medium",
              tone === "gain" && "text-(--color-trading-gain)",
              tone === "loss" && "text-(--color-trading-loss)",
            )}
          >
            {value}
          </p>
        )}
      </div>
      <p className="text-xs text-(--color-text-secondary)">{note}</p>
    </section>
  );
}
