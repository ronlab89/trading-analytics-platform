import type { DecisionResponse } from "@trading/contracts";
import { useTranslation } from "react-i18next";
import { AnalyticsKpiCard } from "@/features/analytics/components/analytics-kpi-card";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney, formatSignedPercent } from "@/lib/format-number";
import { percentFromEntry } from "../lib/price-offset";
import type { TimelineItem } from "../lib/event-timeline";

interface DecisionIndicatorsProps {
  decision: DecisionResponse;
  items: readonly TimelineItem[];
}

/**
 * The four indicators under the title of a decision, as the Figma draws them: the entry, the target,
 * the stop and the risk. The entry says when the position was opened and how many units; the target
 * and the stop say how far they are from the entry. A price the decision does not set is a dash.
 * The "current return" of the Figma needs the price of today and waits for the player.
 */
export function DecisionIndicators({ decision, items }: DecisionIndicatorsProps) {
  const { t, i18n } = useTranslation();
  const opened = items.find((item) => item.type === "POSITION_OPENED");
  const units = opened?.quantity ?? null;
  const fromEntry = (price: DecisionResponse["targetPrice"]) => {
    const percent = percentFromEntry(decision.entryPrice, price);
    return percent === null
      ? t("decisions.detail.notes.notSet")
      : t("decisions.detail.notes.fromEntry", { percent: formatSignedPercent(percent) });
  };
  const price = (value: DecisionResponse["entryPrice"]) =>
    value === null ? "—" : formatMoney(value);

  return (
    <div className="grid grid-cols-2 gap-4 desktop:grid-cols-4 desktop:gap-6">
      <AnalyticsKpiCard
        label={t("decisions.detail.indicators.entry")}
        note={
          opened === undefined || units === null
            ? t("decisions.detail.notes.entryNone")
            : t("decisions.detail.notes.entryOpened", {
                date: formatDateTime(opened.timestamp, i18n.language),
                quantity: units,
              })
        }
        value={price(decision.entryPrice)}
      />
      <AnalyticsKpiCard
        label={t("decisions.detail.indicators.target")}
        note={fromEntry(decision.targetPrice)}
        value={price(decision.targetPrice)}
      />
      <AnalyticsKpiCard
        label={t("decisions.detail.indicators.stop")}
        note={fromEntry(decision.stopPrice)}
        value={price(decision.stopPrice)}
      />
      <AnalyticsKpiCard
        label={t("decisions.detail.indicators.risk")}
        note={t("decisions.detail.notes.recorded", {
          date: formatDateTime(decision.createdAt, i18n.language),
        })}
        value={
          decision.riskLevel === null
            ? "—"
            : t(`decisions.detail.risk.${decision.riskLevel}`, { defaultValue: decision.riskLevel })
        }
      />
    </div>
  );
}
