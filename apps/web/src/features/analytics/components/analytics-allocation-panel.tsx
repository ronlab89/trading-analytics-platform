import type { AllocationGroupBy } from "@trading/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { formatMoney, formatPercent } from "@/lib/format-number";
import { useAllocation } from "../hooks/use-allocation";
import { toAllocationRows, type AllocationRow } from "../lib/allocation-rows";
import { AnalyticsPanel, AnalyticsPanelError, AnalyticsPanelLoading } from "./analytics-panel";

interface AnalyticsAllocationPanelProps {
  portfolioId: string;
}

const GROUPINGS = [
  "asset",
  "assetType",
  "currency",
] as const satisfies readonly AllocationGroupBy[];

/** One color per row, in the order of the Figma: dark, grey, light orange, orange, light grey. */
const ROW_COLORS = [
  "var(--color-chart-series-1)",
  "var(--color-chart-series-2)",
  "var(--color-chart-series-3)",
  "var(--color-chart-series-4)",
  "var(--color-chart-neutral)",
] as const;

const colorOf = (index: number) => ROW_COLORS[index] ?? "var(--color-chart-neutral)";

function isGrouping(value: string): value is AllocationGroupBy {
  return GROUPINGS.some((grouping) => grouping === value);
}

/**
 * The Figma "Asignación": how the portfolio is split today, by asset, by type or by currency, with
 * the weight of each group as a figure and as a bar. The figures carry everything, so the bar and
 * the color are only a picture. It is the current state, so it does not depend on the period. It
 * asks for the grouping that is on, so it loads, fails and retries on its own.
 */
export function AnalyticsAllocationPanel({ portfolioId }: AnalyticsAllocationPanelProps) {
  const { t } = useTranslation();
  const [groupBy, setGroupBy] = useState<AllocationGroupBy>("asset");
  const allocation = useAllocation(portfolioId, groupBy);
  const result = allocation.data === undefined ? null : toAllocationRows(allocation.data.groups);

  const labelOf = (row: AllocationRow) =>
    groupBy === "assetType"
      ? t(`markets.assetType.${row.key}`, { defaultValue: row.label })
      : row.label;

  return (
    <AnalyticsPanel
      aside={
        <Tabs
          onValueChange={(value) => {
            if (isGrouping(value)) setGroupBy(value);
          }}
          value={groupBy}
        >
          <TabsList aria-label={t("analytics.allocation.groupBy")}>
            {GROUPINGS.map((grouping) => (
              // The panel these switch is the chart beside them, not a tab panel, so nothing to control.
              <TabsTrigger aria-controls={undefined} key={grouping} value={grouping}>
                {t(`analytics.allocation.tabs.${grouping}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
      busy={allocation.isPlaceholderData}
      subtitle={
        result === null
          ? undefined
          : t("analytics.allocation.subtitle", { total: formatMoney(result.invested) })
      }
      title={t("analytics.allocation.title")}
    >
      {allocation.isError ? (
        <AnalyticsPanelError
          description={t("analytics.allocation.failed.description")}
          onRetry={() => {
            void allocation.refetch();
          }}
          title={t("analytics.allocation.failed.title")}
        />
      ) : allocation.isPending ? (
        <AnalyticsPanelLoading label={t("analytics.allocation.loading")} />
      ) : result === null ? (
        <PortfoliosEmptyState
          description={t("analytics.allocation.empty.description")}
          title={t("analytics.allocation.empty.title")}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {result.rows.map((row, index) => (
            <li className="flex flex-col gap-2" key={row.key}>
              <div className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-xs"
                  style={{ backgroundColor: colorOf(index) }}
                />
                <span className="min-w-0 flex-1 truncate text-(--color-text-default)">
                  {labelOf(row)}
                </span>
                <span className="text-(--color-text-secondary) tabular-nums">
                  {formatMoney(row.marketValue)}
                </span>
                <span className="w-14 text-right font-medium text-(--color-text-default) tabular-nums">
                  {formatPercent(row.percentage)}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="h-2 overflow-hidden rounded-full bg-(--color-surface-secondary)"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: colorOf(index),
                    width: `${String(Math.min(100, Math.max(0, row.percentage)))}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </AnalyticsPanel>
  );
}
