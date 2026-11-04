import type { DotProps } from "recharts";
import { useTranslation } from "react-i18next";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDayMonth } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-number";
import {
  priceDomain,
  type PriceCursor,
  type PriceLevel,
  type PricePoint,
} from "../lib/price-series";

const CHART_HEIGHT = 288;
const TAG_WIDTH = 84;
const TAG_HEIGHT = 48;
const TAG_GAP = 12;

const LEVEL_COLORS: Record<PriceLevel["key"], string> = {
  target: "var(--color-chart-gain)",
  entry: "var(--color-text-secondary)",
  stop: "var(--color-chart-loss)",
};

/** Target labels go over their line and the rest under it, as the Figma places them. */
const LEVEL_LABEL_POSITION: Record<PriceLevel["key"], "insideTopRight" | "insideBottomRight"> = {
  target: "insideBottomRight",
  entry: "insideTopRight",
  stop: "insideTopRight",
};

interface CursorMarkProps extends DotProps {
  /** How far along the line the cursor is, from 0 to 1. */
  progress: number;
  date: string;
  price: string;
}

/**
 * The hollow dot on the current day with the tag the Figma keeps on it. The tag stays inside the
 * plot: it leans to the side near either end and drops under the dot near the top.
 */
function CursorMark({ cx = 0, cy = 0, progress, date, price }: CursorMarkProps) {
  const lean = progress > 0.85 ? TAG_WIDTH : progress < 0.1 ? 0 : TAG_WIDTH / 2;
  const x = cx - lean;
  const above = cy - TAG_GAP - TAG_HEIGHT;
  const y = above < 0 ? cy + TAG_GAP : above;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        fill="var(--color-surface-card)"
        r={5}
        stroke="var(--color-chart-series-1)"
        strokeWidth={2}
      />
      <rect
        fill="var(--color-chart-tooltip)"
        height={TAG_HEIGHT}
        rx={6}
        width={TAG_WIDTH}
        x={x}
        y={y}
      />
      <text
        fill="var(--color-chart-tooltip-text)"
        fontSize={12}
        opacity={0.7}
        x={x + 12}
        y={y + 19}
      >
        {date}
      </text>
      <text
        fill="var(--color-chart-tooltip-text)"
        fontSize={14}
        fontWeight={500}
        x={x + 12}
        y={y + 37}
      >
        {price}
      </text>
    </g>
  );
}

interface PriceReplayChartProps {
  points: PricePoint[];
  cursor: PriceCursor | null;
  levels: readonly PriceLevel[];
  currency: string;
  label: string;
}

/**
 * The Figma "Precio": the closes as one line, dark with a soft area up to the event the replay is on
 * and grey after it, with the entry, the target and the stop as dashed guides. It has no animation,
 * so playing moves the cursor and does not redraw the line. It is drawn for the eye only: the caller
 * says the same in words.
 */
export function PriceReplayChart({
  points,
  cursor,
  levels,
  currency,
  label,
}: PriceReplayChartProps) {
  const { t, i18n } = useTranslation();
  const money = (value: number) => formatMoney({ amount: String(value), currency });
  const lastIndex = Math.max(points.length - 1, 1);

  return (
    <div aria-label={label} className="text-xs" role="img">
      <ResponsiveContainer height={CHART_HEIGHT} width="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            axisLine={false}
            dataKey="date"
            interval="preserveStartEnd"
            minTickGap={48}
            stroke="var(--color-text-secondary)"
            tickFormatter={(day: string) => formatDayMonth(day, i18n.language)}
            tickLine={false}
          />
          <YAxis domain={priceDomain(points, levels)} hide />
          <Tooltip
            content={({ active, label: day, payload }) => {
              const point = payload[0]?.payload as PricePoint | undefined;
              if (!active || typeof day !== "string" || point === undefined) return null;
              return (
                <div className="rounded-md bg-(--color-chart-tooltip) px-3 py-2 text-(--color-chart-tooltip-text)">
                  <p className="text-xs opacity-70">{formatDayMonth(day, i18n.language)}</p>
                  <p className="text-sm font-medium">{money(point.close)}</p>
                </div>
              );
            }}
            cursor={{ stroke: "var(--color-chart-axis)", strokeDasharray: "2 2" }}
          />
          {levels.map((level) => (
            <ReferenceLine
              key={level.key}
              label={{
                fill: LEVEL_COLORS[level.key],
                fontSize: 12,
                position: LEVEL_LABEL_POSITION[level.key],
                value: `${t(`decisions.detail.indicators.${level.key}`)} ${formatMoney(level.price)}`,
              }}
              stroke={LEVEL_COLORS[level.key]}
              strokeDasharray="4 4"
              y={level.value}
            />
          ))}
          <Area
            activeDot={false}
            dataKey="played"
            fill="var(--color-chart-halo)"
            fillOpacity={0.4}
            isAnimationActive={false}
            stroke="var(--color-chart-series-1)"
            strokeWidth={2}
            type="linear"
          />
          <Line
            activeDot={false}
            dataKey="upcoming"
            dot={false}
            isAnimationActive={false}
            stroke="var(--color-chart-series-2)"
            strokeWidth={2}
            type="linear"
          />
          {cursor === null ? null : (
            <ReferenceLine
              stroke="var(--color-chart-series-1)"
              strokeDasharray="2 2"
              x={cursor.date}
            />
          )}
          {cursor === null ? null : (
            <ReferenceDot
              shape={(props: DotProps) => (
                <CursorMark
                  {...props}
                  date={formatDayMonth(cursor.date, i18n.language)}
                  price={money(cursor.close)}
                  progress={cursor.index / lastIndex}
                />
              )}
              x={cursor.date}
              y={cursor.close}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
