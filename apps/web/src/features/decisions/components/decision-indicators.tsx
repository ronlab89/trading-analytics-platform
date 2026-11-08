import type { DecisionReplayStateResponse, DecisionResponse } from "@trading/contracts";
import type { TFunction } from "i18next";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnalyticsKpiCard, type KpiTone } from "@/features/analytics/components/analytics-kpi-card";
import { useIsMobile } from "@/hooks/use-media-query";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney, formatSignedMoney, formatSignedPercent } from "@/lib/format-number";
import { currentReturnOf, type CurrentReturn } from "../lib/current-return";
import { percentFromEntry } from "../lib/price-offset";
import type { TimelineItem } from "../lib/event-timeline";

interface DecisionIndicatorsProps {
  decision: DecisionResponse;
  items: readonly TimelineItem[];
  /** The decision as it stands today, after all its events. */
  state: DecisionReplayStateResponse;
}

function toneOf(result: CurrentReturn): KpiTone {
  if (result.kind === "none") return "neutral";
  const figure = result.kind === "open" ? result.percent : Number(result.profit.amount);
  if (figure === 0) return "neutral";
  return figure > 0 ? "gain" : "loss";
}

/** The figure with the arrow of the Figma, so a gain or a loss is not told by color alone. */
function valueOfReturn(result: CurrentReturn): ReactNode {
  if (result.kind === "none") return "—";
  const figure =
    result.kind === "open" ? formatSignedPercent(result.percent) : formatSignedMoney(result.profit);
  const tone = toneOf(result);

  return (
    <>
      {figure}
      {tone === "gain" ? <ArrowUp aria-hidden="true" className="size-4" /> : null}
      {tone === "loss" ? <ArrowDown aria-hidden="true" className="size-4" /> : null}
    </>
  );
}

function noteOfReturn(result: CurrentReturn, t: TFunction): string | null {
  if (result.kind === "none") return t("decisions.detail.notes.entryNone");
  if (result.price === null) return null;
  return t(
    result.kind === "open" ? "decisions.detail.notes.price" : "decisions.detail.notes.closedAt",
    {
      price: formatMoney(result.price),
    },
  );
}

/**
 * The four indicators under the title of a decision, as the Figma draws them: the entry, the target,
 * the stop and the current return. The entry says when the position was opened and how many units;
 * the target and the stop say how far they are from the entry. A price the decision does not set is
 * a dash. These figures are today's, as the Figma keeps them while the replay moves.
 */
export function DecisionIndicators({ decision, items, state }: DecisionIndicatorsProps) {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
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

  const result = currentReturnOf(state, decision.direction);
  const returnNote = noteOfReturn(result, t);
  const riskNote =
    isMobile || state.riskLevel === null
      ? null
      : t("decisions.detail.notes.risk", {
          level: t(`decisions.detail.risk.${state.riskLevel}`, {
            defaultValue: state.riskLevel,
          }).toLowerCase(),
        });

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
        label={t("decisions.detail.indicators.currentReturn")}
        note={[returnNote, riskNote].filter((part) => part !== null).join(" · ")}
        tone={toneOf(result)}
        value={valueOfReturn(result)}
      />
    </div>
  );
}
