import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortMonth } from "@/lib/format-date";
import { formatSignedPercent } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import { usePerformance } from "../hooks/use-performance";
import { type MonthReturn, monthlyReturns } from "../lib/performance-stats";

/** How many months the Figma "Rendimiento mensual" draws. */
const MONTHS = 6;
const MIN_BAR_PX = 28;
const MAX_BAR_PX = 104;

function barHeight(percent: number, largest: number): number {
  if (largest === 0) return MIN_BAR_PX;
  return Math.round(MIN_BAR_PX + (Math.abs(percent) / largest) * (MAX_BAR_PX - MIN_BAR_PX));
}

function MonthlyBars({ months }: { months: readonly MonthReturn[] }) {
  const { t, i18n } = useTranslation();
  const largest = Math.max(...months.map((m) => Math.abs(m.percent)));

  return (
    <ul
      aria-label={t("dashboard.monthly.chartLabel")}
      className="m-0 grid list-none grid-flow-col auto-cols-fr items-end gap-2 rounded-xl bg-(--color-surface-secondary) p-3 tablet:gap-3"
    >
      {months.map((month, index) => {
        const negative = month.percent < 0;
        const current = index === months.length - 1;
        const label = formatShortMonth(month.month, i18n.language);
        return (
          <li className="flex min-w-0 flex-col items-center gap-2" key={month.month}>
            <span
              className={cn(
                "text-xs",
                negative
                  ? "text-(--color-trading-loss)"
                  : current
                    ? "font-medium text-(--color-text-default)"
                    : "text-(--color-text-secondary)",
              )}
            >
              {formatSignedPercent(month.percent)}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "w-full rounded-md border",
                negative
                  ? "border-dashed border-(--color-chart-loss) bg-(--color-chart-loss)/10"
                  : current
                    ? "border-transparent bg-linear-to-br from-(--color-brand-brand-gradient-from) to-(--color-brand-brand)"
                    : "border-(--color-chart-series-3) bg-(--color-chart-bar)",
              )}
              style={{ height: barHeight(month.percent, largest) }}
            />
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs",
                current
                  ? "border-transparent bg-(--color-surface-inverse) text-(--color-text-on-primary)"
                  : "border-(--color-chart-neutral) text-(--color-text-secondary)",
              )}
            >
              {label}
              {current ? (
                <span className="sr-only"> ({t("dashboard.monthly.current")})</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

interface MonthlyReturnsProps {
  portfolioId: string;
}

/**
 * The Figma "Rendimiento mensual": the return of each of the last six months as a bar with its
 * percentage on top and its month below. The latest month is the one in progress, dark and marked
 * for a screen reader; a month with a loss is dashed and red, with its minus sign. It is plain
 * markup because it has no axes to draw, and it asks for its own data: while that loads it shows a
 * block, when it fails it says so with a retry, and when there is no month yet it shows nothing.
 */
export function MonthlyReturns({ portfolioId }: MonthlyReturnsProps) {
  const { t } = useTranslation();
  const performance = usePerformance(portfolioId, "6M");

  if (performance.isError) {
    return (
      <Alert
        action={
          <Button
            onClick={() => {
              void performance.refetch();
            }}
            size="sm"
            variant="outline"
          >
            {t("dashboard.monthly.retry")}
          </Button>
        }
        title={t("dashboard.monthly.failed")}
        tone="error"
      />
    );
  }
  if (performance.isPending) {
    return (
      <div aria-label={t("dashboard.monthly.loading")} role="status">
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }
  const months =
    performance.data.status === "OK" ? monthlyReturns(performance.data.series).slice(-MONTHS) : [];
  if (months.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-(--color-text-default)">
        {t("dashboard.monthly.title")}
      </h3>
      <MonthlyBars months={months} />
    </div>
  );
}
