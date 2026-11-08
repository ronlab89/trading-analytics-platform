import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { PerformancePeriod } from "../hooks/use-performance";

/** The periods of the Figma selector (1S · 1M · 3M · Año · Todo) and the preset each one asks for. */
export const PERFORMANCE_PERIODS = [
  "1W",
  "1M",
  "3M",
  "YTD",
  "ALL",
] as const satisfies readonly PerformancePeriod[];

interface PerformancePeriodTabsProps {
  value: PerformancePeriod;
  onChange: (period: PerformancePeriod) => void;
}

/** The small segmented selector of the chart panels: one period is pressed at a time. */
export function PerformancePeriodTabs({ value, onChange }: PerformancePeriodTabsProps) {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("dashboard.performance.periodLabel")}
      className="flex gap-0.5 rounded-md bg-(--color-surface-secondary) p-0.5"
      role="group"
    >
      {PERFORMANCE_PERIODS.map((period) => (
        <button
          aria-pressed={period === value}
          className={cn(
            "h-7 rounded-sm px-2.5 text-xs font-medium text-(--color-text-secondary) outline-none focus-visible:ring-2 focus-visible:ring-(--color-brand-brand)",
            period === value
              ? "bg-(--color-surface-card) text-(--color-text-default) shadow-xs"
              : "hover:text-(--color-text-default)",
          )}
          key={period}
          onClick={() => {
            onChange(period);
          }}
          type="button"
        >
          {t(`dashboard.performance.periods.${period}`)}
        </button>
      ))}
    </div>
  );
}
