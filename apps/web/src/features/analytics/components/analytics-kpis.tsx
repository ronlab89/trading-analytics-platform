import { useTranslation } from "react-i18next";
import { DirectionMark } from "@/features/dashboard/components/direction-mark";
import { formatPercent, formatSignedPercent } from "@/lib/format-number";
import { useAllocation } from "../hooks/use-allocation";
import { usePeriodPerformance } from "../hooks/use-period-performance";
import { useRisk } from "../hooks/use-risk";
import type { AnalyticsPeriod } from "../lib/analytics-period";
import { concentrationOf } from "../lib/concentration";
import { periodLabel } from "../lib/period-label";
import { AnalyticsKpiCard, type KpiTone } from "./analytics-kpi-card";

interface AnalyticsKpisProps {
  portfolioId: string;
  portfolioName: string;
  period: AnalyticsPeriod;
}

const toneOf = (points: number): KpiTone => (points > 0 ? "gain" : points < 0 ? "loss" : "neutral");

/**
 * The four indicators of the Figma "Análisis": the return of the period, the volatility, the
 * maximum drawdown and the concentration. Each asks for its own data, so one that fails or has too
 * little history shows a dash and says so without taking the others down. The return, the
 * volatility and the drawdown follow the period; the concentration is the current allocation.
 */
export function AnalyticsKpis({ portfolioId, portfolioName, period }: AnalyticsKpisProps) {
  const { t, i18n } = useTranslation();
  const performance = usePeriodPerformance(portfolioId, period);
  const risk = useRisk(portfolioId, period);
  const allocation = useAllocation(portfolioId, "asset");
  const label = periodLabel(period, t, i18n.language);
  const unavailable = t("analytics.kpi.unavailable");
  const noData = t("analytics.kpi.noData");

  const twr = performance.data?.twrPercent ?? null;
  const volatility = risk.data?.volatilityPercent ?? null;
  const drawdown = risk.data?.maxDrawdownPercent ?? null;
  const concentration = allocation.data ? concentrationOf(allocation.data.groups) : null;

  return (
    <div className="grid grid-cols-4 gap-4 max-desktop:grid-cols-2 max-tablet:grid-cols-1">
      <AnalyticsKpiCard
        label={t("analytics.kpi.return")}
        loading={performance.isPending}
        note={
          performance.isError
            ? unavailable
            : twr === null
              ? noData
              : t("analytics.kpi.returnNote", { portfolio: portfolioName, period: label })
        }
        tone={twr === null ? "neutral" : toneOf(twr)}
        value={
          twr === null ? (
            "—"
          ) : (
            <>
              {formatSignedPercent(twr)}
              <DirectionMark percent={twr} />
            </>
          )
        }
      />
      <AnalyticsKpiCard
        label={t("analytics.kpi.volatility")}
        loading={risk.isPending}
        note={
          risk.isError
            ? unavailable
            : volatility === null
              ? noData
              : t("analytics.kpi.volatilityNote", { period: label })
        }
        value={volatility === null ? "—" : formatPercent(volatility)}
      />
      <AnalyticsKpiCard
        label={t("analytics.kpi.drawdown")}
        loading={risk.isPending}
        note={
          risk.isError ? unavailable : drawdown === null ? noData : t("analytics.kpi.drawdownNote")
        }
        tone={drawdown === null ? "neutral" : toneOf(drawdown)}
        value={
          drawdown === null ? (
            "—"
          ) : (
            <>
              {formatPercent(drawdown)}
              <DirectionMark percent={drawdown} />
            </>
          )
        }
      />
      <AnalyticsKpiCard
        label={t("analytics.kpi.concentration")}
        loading={allocation.isPending}
        note={
          allocation.isError
            ? unavailable
            : concentration === null
              ? noData
              : t("analytics.kpi.concentrationNote", {
                  asset: concentration.label,
                  level: t(`analytics.kpi.levels.${concentration.level}`),
                })
        }
        value={concentration === null ? "—" : `${String(Math.round(concentration.percent))}%`}
      />
    </div>
  );
}
