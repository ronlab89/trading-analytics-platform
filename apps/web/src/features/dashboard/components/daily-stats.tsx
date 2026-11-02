import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatSignedPercent } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import type { DailyStats as DailyStatsData } from "../lib/performance-stats";
import { DirectionMark } from "./direction-mark";

interface StatProps {
  label: string;
  tone?: "gain" | "loss" | "neutral";
  children: ReactNode;
}

function Stat({ label, tone = "neutral", children }: StatProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-(--color-text-secondary)">{label}</dt>
      <dd
        className={cn(
          "text-base leading-6 font-medium whitespace-nowrap",
          tone === "gain" && "text-(--color-chart-gain)",
          tone === "loss" && "text-(--color-chart-loss)",
          tone === "neutral" && "text-(--color-text-default)",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function toneOf(percent: number): "gain" | "loss" | "neutral" {
  if (percent > 0) return "gain";
  if (percent < 0) return "loss";
  return "neutral";
}

/**
 * The five figures under the daily chart: best day, worst day, share of positive days, daily
 * average and current streak. A gain or a loss carries its sign and an arrow besides its color.
 */
export function DailyStats({ stats }: { stats: DailyStatsData }) {
  const { t } = useTranslation();
  const { best, worst, average, streak } = {
    best: stats.best.percent,
    worst: stats.worst.percent,
    average: stats.averagePercent,
    streak: stats.streak,
  };
  const streakTone =
    streak.direction === "up" ? "gain" : streak.direction === "down" ? "loss" : "neutral";

  return (
    <dl className="grid grid-cols-2 gap-4 tablet:grid-cols-3 desktop:grid-cols-5">
      <Stat label={t("dashboard.dailyReturns.stats.best")} tone={toneOf(best)}>
        {formatSignedPercent(best)} <DirectionMark percent={best} />
      </Stat>
      <Stat label={t("dashboard.dailyReturns.stats.worst")} tone={toneOf(worst)}>
        {formatSignedPercent(worst)} <DirectionMark percent={worst} />
      </Stat>
      <Stat label={t("dashboard.dailyReturns.stats.positive")}>
        {`${String(Math.round(stats.positiveDaysPercent))}%`}
      </Stat>
      <Stat label={t("dashboard.dailyReturns.stats.average")}>{formatSignedPercent(average)}</Stat>
      <Stat label={t("dashboard.dailyReturns.stats.streak")} tone={streakTone}>
        {streak.direction === "flat"
          ? t("dashboard.dailyReturns.stats.streakFlat")
          : t(
              streak.direction === "up"
                ? "dashboard.dailyReturns.stats.streakUp"
                : "dashboard.dailyReturns.stats.streakDown",
              { count: streak.days },
            )}{" "}
        <DirectionMark
          percent={streak.direction === "up" ? 1 : streak.direction === "down" ? -1 : 0}
        />
      </Stat>
    </dl>
  );
}
