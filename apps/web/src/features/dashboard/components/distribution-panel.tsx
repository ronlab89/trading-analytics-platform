import type { AllocationResponse, MoneyDto } from "@trading/contracts";
import { useTranslation } from "react-i18next";
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { formatMoney } from "@/lib/format-number";
import { toAllocationSlices } from "../lib/allocation-slices";

interface DistributionPanelProps {
  allocation: AllocationResponse;
  /** What the portfolio has invested, for the subtitle. */
  investedValue: MoneyDto;
}

/** Up to five rings, as the Figma draws them: the four largest assets and the rest together. */
const MAX_RINGS = 5;
const CHART_SIZE = 220;

/** One color per ring, in the order of the Figma: dark, orange, light orange, grey, light grey. */
const RING_COLORS = [
  "var(--color-chart-series-1)",
  "var(--color-chart-series-4)",
  "var(--color-chart-series-3)",
  "var(--color-chart-series-2)",
  "var(--color-chart-neutral)",
] as const;

function colorOf(index: number): string {
  return RING_COLORS[index] ?? "var(--color-chart-neutral)";
}

/**
 * The Figma "Distribución": the weight of each asset as concentric rings, the largest outside, and
 * a legend with the name, the value and the percentage of each. The rings are only a picture: the
 * legend carries every figure, so color is never the only datum and the chart is hidden from a
 * screen reader. The overview already carries the allocation, so there is no request of its own.
 */
export function DistributionPanel({ allocation, investedValue }: DistributionPanelProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const slices = toAllocationSlices(
    allocation.groups,
    MAX_RINGS,
    t("dashboard.distribution.others"),
  );
  // The first data entry is the innermost ring; the largest goes outside.
  const rings = slices.map((slice, index) => ({ ...slice, fill: colorOf(index) })).reverse();

  return (
    <section
      aria-labelledby="dashboard-distribution-title"
      className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-5"
    >
      <div className="flex flex-col gap-1">
        <h2
          className="text-lg leading-6 font-medium text-(--color-text-default)"
          id="dashboard-distribution-title"
        >
          {t("dashboard.distribution.title")}
        </h2>
        <p className="text-xs text-(--color-text-secondary)">
          {t("dashboard.distribution.subtitle", { invested: formatMoney(investedValue) })}
        </p>
      </div>
      {slices.length === 0 ? (
        <PortfoliosEmptyState
          description={t("dashboard.distribution.empty.description")}
          title={t("dashboard.distribution.empty.title")}
        />
      ) : (
        <div className="flex flex-col items-center gap-6 tablet:flex-row">
          <div
            aria-hidden="true"
            className="shrink-0"
            style={{ height: CHART_SIZE, width: CHART_SIZE }}
          >
            <ResponsiveContainer height="100%" width="100%">
              <RadialBarChart
                barSize={14}
                data={rings}
                endAngle={-270}
                innerRadius="18%"
                outerRadius="100%"
                startAngle={90}
              >
                <PolarAngleAxis domain={[0, 100]} tick={false} type="number" />
                <RadialBar
                  background={{ fill: "var(--color-surface-secondary)" }}
                  cornerRadius={7}
                  dataKey="percentage"
                  isAnimationActive={!reduceMotion}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <ul className="m-0 flex w-full min-w-0 list-none flex-col p-0">
            {slices.map((slice, index) => (
              <li
                className="grid grid-cols-[auto_1fr_auto_3rem] items-center gap-3 border-b border-(--color-border-default) py-2.5 text-sm last:border-b-0"
                key={slice.key}
              >
                <span
                  aria-hidden="true"
                  className="size-3 rounded-sm"
                  style={{ background: colorOf(index) }}
                />
                <span className="truncate text-(--color-text-default)">{slice.label}</span>
                <span className="text-(--color-text-secondary)">
                  {formatMoney(slice.marketValue)}
                </span>
                <span className="text-right font-medium text-(--color-text-default)">
                  {`${String(Math.round(slice.percentage))}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
