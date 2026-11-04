import type { ScenarioCalculationResponse } from "@trading/contracts";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AnalyticsPanel,
  AnalyticsPanelLoading,
} from "@/features/analytics/components/analytics-panel";
import { PriceChangeBadge } from "@/features/watchlist/components/price-change-badge";
import { formatMoney, formatSignedPercent } from "@/lib/format-number";

interface ScenarioImpactPanelProps {
  /** The last calculation; undefined until the first one arrives. */
  calculation: ScenarioCalculationResponse | undefined;
  /** A new calculation is on its way: the last figures stay on screen. */
  recalculating: boolean;
  /** The scenario could not be saved or calculated. */
  failed: boolean;
  onRetry: () => void;
}

interface ComparisonProps {
  label: string;
  base: string;
  scenario: string;
  delta: number | null;
}

/** One figure of the Figma "Comparison": the base, an arrow, the value with the scenario and the change. */
function Comparison({ label, base, scenario, delta }: ComparisonProps) {
  return (
    <div aria-label={label} className="flex min-w-0 flex-1 flex-col gap-1" role="group">
      <span className="text-xs text-(--color-text-secondary)">{label}</span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-(--color-text-secondary)">{base}</span>
        <ArrowRight aria-hidden="true" className="size-4 text-(--color-text-secondary)" />
        <span className="text-lg leading-7 font-semibold text-(--color-text-default)">
          {scenario}
        </span>
        <PriceChangeBadge percent={delta} />
      </span>
    </div>
  );
}

/**
 * The "Scenario impact" card: what the scenario does to the value and the return of the portfolio.
 * The figures are the API's, nothing else is made up (no volatility, no concentration). It always
 * says the scenario is isolated from the real portfolio. While a new calculation is on its way the
 * last figures stay, and when it failed they go, so an old figure is never taken for the current one.
 */
export function ScenarioImpactPanel({
  calculation,
  recalculating,
  failed,
  onRetry,
}: ScenarioImpactPanelProps) {
  const { t } = useTranslation();

  const baseValue = calculation === undefined ? 0 : Number(calculation.baseline.totalValue.amount);

  return (
    <AnalyticsPanel
      aside={
        recalculating && !failed ? (
          <span
            className="flex items-center gap-2 text-sm text-(--color-text-secondary)"
            role="status"
          >
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {t("scenarios.editor.impact.recalculating")}
          </span>
        ) : null
      }
      busy={recalculating && !failed}
      subtitle={t("scenarios.editor.impact.description")}
      title={t("scenarios.editor.impact.title")}
    >
      {failed ? (
        <Alert
          action={
            <Button onClick={onRetry} size="sm" variant="outline">
              {t("scenarios.editor.impact.retry")}
            </Button>
          }
          description={t("scenarios.editor.impact.failedDescription")}
          title={t("scenarios.editor.impact.failedTitle")}
          tone="error"
        />
      ) : calculation === undefined ? (
        <AnalyticsPanelLoading label={t("scenarios.editor.impact.loading")} />
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <Comparison
            base={formatMoney(calculation.baseline.totalValue)}
            delta={
              baseValue === 0
                ? null
                : ((Number(calculation.result.totalValue.amount) - baseValue) / baseValue) * 100
            }
            label={t("scenarios.editor.impact.value")}
            scenario={formatMoney(calculation.result.totalValue)}
          />
          <Comparison
            base={formatSignedPercent(calculation.baseline.unrealizedPnLPercent)}
            delta={
              calculation.result.unrealizedPnLPercent - calculation.baseline.unrealizedPnLPercent
            }
            label={t("scenarios.editor.impact.return")}
            scenario={formatSignedPercent(calculation.result.unrealizedPnLPercent)}
          />
        </div>
      )}
      <Alert
        description={t("scenarios.editor.impact.isolatedDescription")}
        title={t("scenarios.editor.impact.isolatedTitle")}
        tone="info"
      />
    </AnalyticsPanel>
  );
}
