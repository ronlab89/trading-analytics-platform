import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDayMonth } from "@/lib/format-date";
import { formatSignedPercent } from "@/lib/format-number";
import type { DailyStats, DayReturn } from "../lib/performance-stats";
import { DirectionMark } from "./direction-mark";

interface DailyReturnsChartProps {
  days: readonly DayReturn[];
  stats: DailyStats;
}

const CHART_HEIGHT = 208;
const GAIN = "var(--color-chart-gain)";
const LOSS = "var(--color-chart-loss)";

/**
 * The Figma "Rendimiento diario (barras divergentes)": one bar per day, green above the zero line
 * and red below it, so the size and the direction of each day read at a glance. Color is never the
 * only datum: the tooltip writes the sign and an arrow too. A sentence stands in for the bars on a
 * screen reader.
 */
export function DailyReturnsChart({ days, stats }: DailyReturnsChartProps) {
  const { t, i18n } = useTranslation();
  const first = days[0];
  const last = days.at(-1);

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div
        aria-label={t("dashboard.dailyReturns.chartLabel")}
        className="text-xs"
        role="img"
        style={{ height: CHART_HEIGHT }}
      >
        <ResponsiveContainer height="100%" width="100%">
          <BarChart
            data={days.map((day) => ({ ...day, fill: day.percent < 0 ? LOSS : GAIN }))}
            margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
          >
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
              stroke="var(--color-text-secondary)"
              tickFormatter={(value: number) => `${value > 0 ? "+" : ""}${String(value)}%`}
              tickLine={false}
              width={40}
            />
            <ReferenceLine stroke="var(--color-chart-axis)" y={0} />
            <Tooltip
              content={({ active, label, payload }) => {
                const percent = payload[0]?.value;
                if (!active || typeof label !== "string" || typeof percent !== "number") {
                  return null;
                }
                return (
                  <div className="rounded-md bg-(--color-chart-tooltip) px-3 py-2 text-(--color-chart-tooltip-text)">
                    <p className="text-xs opacity-70">{formatDayMonth(label, i18n.language)}</p>
                    <p className="text-sm font-medium">
                      {formatSignedPercent(percent)} <DirectionMark percent={percent} />
                    </p>
                  </div>
                );
              }}
              cursor={{ fill: "var(--color-surface-subtle)" }}
            />
            <Bar dataKey="percent" isAnimationActive={false} radius={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {first !== undefined && last !== undefined ? (
        <figcaption className="sr-only">
          {t("dashboard.dailyReturns.summary", {
            count: days.length,
            from: formatDayMonth(first.date, i18n.language),
            to: formatDayMonth(last.date, i18n.language),
            positive: `${String(Math.round(stats.positiveDaysPercent))}%`,
            best: formatSignedPercent(stats.best.percent),
            bestDate: formatDayMonth(stats.best.date, i18n.language),
            worst: formatSignedPercent(stats.worst.percent),
            worstDate: formatDayMonth(stats.worst.date, i18n.language),
          })}
        </figcaption>
      ) : null}
    </figure>
  );
}
