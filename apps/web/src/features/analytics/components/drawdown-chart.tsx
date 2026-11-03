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
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatDayMonth } from "@/lib/format-date";
import { formatPercent } from "@/lib/format-number";
import { drawdownTicks } from "../lib/drawdown-axis";
import { summarizeDrawdown, type DrawdownPoint } from "../lib/drawdown-series";

interface DrawdownChartProps {
  /** The days of the period, oldest first; at least two. */
  points: DrawdownPoint[];
}

const MIN_CHART_HEIGHT = 256;

const axisPercent = (value: number) => `${String(Math.round(value))}%`;

/**
 * The Figma "Drawdown": how far the portfolio is below its previous high each day, as a red line
 * over a light red area hanging from the 0% guide, with the deepest day marked by a hollow red dot.
 * The chart is drawn for the eye only, so a sentence with the depth and where the period ends
 * stands in for it.
 */
export function DrawdownChart({ points }: DrawdownChartProps) {
  const { t, i18n } = useTranslation();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const ticks = drawdownTicks(points);
  const { deepest, end } = summarizeDrawdown(points);
  const first = points[0];

  return (
    <figure className="m-0 flex flex-1 flex-col gap-2">
      <div
        aria-label={t("analytics.drawdown.chartLabel")}
        className="min-h-0 flex-1 text-xs"
        role="img"
        style={{ minHeight: MIN_CHART_HEIGHT }}
      >
        <ResponsiveContainer height="100%" minHeight={MIN_CHART_HEIGHT} width="100%">
          <AreaChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="drawdown-area" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  style={{ stopColor: "var(--color-chart-loss)", stopOpacity: 0 }}
                />
                <stop
                  offset="100%"
                  style={{ stopColor: "var(--color-chart-loss)", stopOpacity: 0.25 }}
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
              domain={[ticks[2], ticks[0]]}
              orientation="right"
              stroke="var(--color-text-secondary)"
              tickFormatter={axisPercent}
              tickLine={false}
              ticks={ticks}
              width={44}
            />
            <Tooltip
              content={({ active, label, payload }) => {
                const value = payload[0]?.value;
                if (!active || typeof label !== "string" || typeof value !== "number") return null;
                return (
                  <div className="rounded-md bg-(--color-chart-tooltip) px-3 py-2 text-(--color-chart-tooltip-text)">
                    <p className="text-xs opacity-70">{formatDayMonth(label, i18n.language)}</p>
                    <p className="text-sm font-medium">{formatPercent(value)}</p>
                  </div>
                );
              }}
              cursor={{ stroke: "var(--color-chart-loss)", strokeDasharray: "2 2" }}
            />
            <Area
              activeDot={{
                r: 4,
                fill: "var(--color-surface-card)",
                stroke: "var(--color-chart-loss)",
                strokeWidth: 2,
              }}
              dataKey="drawdown"
              fill="url(#drawdown-area)"
              isAnimationActive={!reduceMotion}
              stroke="var(--color-chart-loss)"
              strokeWidth={2}
              type="monotone"
            />
            {deepest.drawdown < 0 ? (
              <ReferenceDot
                fill="var(--color-surface-card)"
                r={4}
                stroke="var(--color-chart-loss)"
                strokeWidth={2}
                x={deepest.date}
                y={deepest.drawdown}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {t("analytics.drawdown.summary", {
          from: formatDayMonth(first?.date ?? end.date, i18n.language),
          to: formatDayMonth(end.date, i18n.language),
          deepest: formatPercent(deepest.drawdown),
          date: formatDayMonth(deepest.date, i18n.language),
          end: formatPercent(end.drawdown),
        })}
      </figcaption>
    </figure>
  );
}
