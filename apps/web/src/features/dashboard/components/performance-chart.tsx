import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { formatDayMonth } from "@/lib/format-date";
import { formatAxisMoney, formatMoney, formatSignedPercent } from "@/lib/format-number";
import { summarizeSeries, type ValueSeries } from "../lib/performance-chart-data";

interface PerformanceChartProps {
  series: ValueSeries;
}

const MIN_CHART_HEIGHT = 256;

/**
 * The Figma "Rendimiento (línea + área)": the value of the portfolio as a dark line over an orange
 * area, three dashed guides with the value on the right, the dates below and a dark tooltip on the
 * point under the pointer. The last day carries the orange dot with its halo. The chart is drawn
 * for the eye only, so a sentence with the start, the end, the high and the low stands in for it.
 */
export function PerformanceChart({ series }: PerformanceChartProps) {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { currency, points } = series;
  const summary = summarizeSeries(points);
  const money = (value: number) => formatMoney({ amount: value.toFixed(2), currency });

  return (
    <figure className="m-0 flex flex-1 flex-col gap-2">
      <div
        aria-label={t("dashboard.performance.chartLabel")}
        className="min-h-0 flex-1 text-xs"
        role="img"
        style={{ minHeight: MIN_CHART_HEIGHT }}
      >
        <ResponsiveContainer height="100%" minHeight={MIN_CHART_HEIGHT} width="100%">
          <AreaChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="performance-area" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  style={{ stopColor: "var(--color-brand-brand-gradient-from)", stopOpacity: 0.55 }}
                />
                <stop
                  offset="100%"
                  style={{ stopColor: "var(--color-brand-brand-gradient-from)", stopOpacity: 0 }}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--color-chart-axis)"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              axisLine={false}
              dataKey="date"
              interval="preserveStartEnd"
              minTickGap={48}
              stroke="var(--color-text-secondary)"
              tickFormatter={(day: string) => formatDayMonth(day, i18n.language)}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              domain={["dataMin", "dataMax"]}
              orientation="right"
              stroke="var(--color-text-secondary)"
              tickCount={3}
              tickFormatter={(value: number) => formatAxisMoney(value, currency)}
              tickLine={false}
              width={52}
            />
            <Tooltip
              content={({ active, label, payload }) => {
                const value = payload[0]?.value;
                if (!active || typeof label !== "string" || typeof value !== "number") return null;
                return (
                  <div className="rounded-md bg-(--color-chart-tooltip) px-3 py-2 text-(--color-chart-tooltip-text)">
                    <p className="text-xs opacity-70">{formatDayMonth(label, i18n.language)}</p>
                    <p className="text-sm font-medium">{formatAxisMoney(value, currency)}</p>
                  </div>
                );
              }}
              cursor={{ stroke: "var(--color-chart-series-1)", strokeDasharray: "2 2" }}
            />
            <Area
              activeDot={{
                r: 4,
                fill: "var(--color-surface-card)",
                stroke: "var(--color-chart-series-1)",
                strokeWidth: 2,
              }}
              dataKey="value"
              fill="url(#performance-area)"
              isAnimationActive={!reduceMotion}
              stroke="var(--color-chart-series-1)"
              strokeWidth={2}
              type="monotone"
            />
            <ReferenceDot
              fill="var(--color-chart-halo)"
              r={10}
              stroke="none"
              x={summary.end.date}
              y={summary.end.value}
            />
            <ReferenceDot
              fill="var(--color-brand-brand)"
              r={4}
              stroke="none"
              x={summary.end.date}
              y={summary.end.value}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {t("dashboard.performance.summary", {
          from: formatDayMonth(summary.start.date, i18n.language),
          to: formatDayMonth(summary.end.date, i18n.language),
          start: money(summary.start.value),
          end: money(summary.end.value),
          change: formatSignedPercent(summary.changePercent),
          high: money(summary.high.value),
          low: money(summary.low.value),
        })}
      </figcaption>
    </figure>
  );
}
