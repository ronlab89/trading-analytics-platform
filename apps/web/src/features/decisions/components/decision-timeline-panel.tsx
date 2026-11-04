import { useTranslation } from "react-i18next";
import { AnalyticsPanel } from "@/features/analytics/components/analytics-panel";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import type { TimelineItem } from "../lib/event-timeline";

/**
 * The sentence under the name of an event, from the figures its payload carries. An event that has
 * none of them says only what happened, so nothing is made up.
 */
function useDetailOf() {
  const { t } = useTranslation();

  return (item: TimelineItem): string | null => {
    const price = item.price === null ? null : formatMoney(item.price);
    switch (item.type) {
      case "POSITION_OPENED":
      case "POSITION_ADJUSTED":
        return item.quantity !== null && price !== null
          ? t("decisions.detail.timeline.details.quantityAtPrice", {
              quantity: item.quantity,
              price,
            })
          : null;
      case "PRICE_UPDATE":
      case "TARGET_REACHED":
        return price === null ? null : t("decisions.detail.timeline.details.price", { price });
      case "POSITION_CLOSED":
        return price === null ? null : t("decisions.detail.timeline.details.closedAt", { price });
      case "RISK_CHANGED":
        return item.riskLevel === null
          ? null
          : t("decisions.detail.timeline.details.riskLevel", {
              level: t(`decisions.detail.risk.${item.riskLevel}`, {
                defaultValue: item.riskLevel,
              }).toLowerCase(),
            });
      case "THESIS_RECORDED":
      case "NOTE_ADDED":
        return item.text;
      default:
        return null;
    }
  };
}

/**
 * The Figma "Evolución de la posición": every event of the decision in order, each with its name,
 * the sentence that says what it did and when. It follows the replay: the current event has the
 * orange dot, the earlier ones a dark dot and the ones still to come a hollow dot and a dimmed name.
 * The events come from the history, so nothing here changes them.
 */
export function DecisionTimelinePanel({
  items,
  currentIndex,
}: {
  items: readonly TimelineItem[];
  currentIndex: number;
}) {
  const { t, i18n } = useTranslation();
  const detailOf = useDetailOf();

  return (
    <AnalyticsPanel
      subtitle={t("decisions.detail.timeline.subtitle", { count: items.length })}
      title={t("decisions.detail.timeline.title")}
    >
      {items.length === 0 ? (
        <p className="text-sm text-(--color-text-secondary)">
          {t("decisions.detail.timeline.empty")}
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-5 p-0">
          {items.map((item, index) => {
            const current = index === currentIndex;
            const upcoming = index > currentIndex;
            const detail = detailOf(item);
            return (
              <li
                aria-current={current ? "step" : undefined}
                className="relative flex gap-3"
                key={item.id}
              >
                {index === items.length - 1 ? null : (
                  <span
                    aria-hidden="true"
                    className="absolute top-3 -bottom-5 left-[5px] w-0.5 bg-(--color-border-default)"
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative mt-1.5 size-3 shrink-0 rounded-full",
                    current && "bg-(--color-chart-series-4) ring-4 ring-(--color-chart-halo)",
                    upcoming &&
                      "border-2 border-(--color-text-secondary) bg-(--color-surface-card)",
                    !current && !upcoming && "bg-(--color-chart-series-1)",
                  )}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        upcoming ? "text-(--color-text-secondary)" : "text-(--color-text-default)",
                      )}
                    >
                      {t(`decisions.detail.timeline.events.${item.type}`)}
                    </p>
                    <time
                      className="shrink-0 text-xs text-(--color-text-secondary)"
                      dateTime={item.timestamp}
                    >
                      {formatDateTime(item.timestamp, i18n.language)}
                    </time>
                  </div>
                  {detail === null ? null : (
                    <p className="text-xs text-(--color-text-secondary)">{detail}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </AnalyticsPanel>
  );
}
