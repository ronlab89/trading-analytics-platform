import type { DecisionResponse } from "@trading/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  AnalyticsPanel,
  AnalyticsPanelError,
  AnalyticsPanelLoading,
} from "@/features/analytics/components/analytics-panel";
import { formatDayMonth } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import { useAssetHistory } from "../hooks/use-asset-history";
import { historyRangeOf, priceLevelsOf, toPriceSeries } from "../lib/price-series";
import { PriceReplayChart } from "./price-replay-chart";

interface DecisionPricePanelProps {
  decision: DecisionResponse;
  /** The symbol of the asset; null when it could not be loaded. */
  symbol: string | null;
  currency: string;
  /** When the event the replay is on happened; null without events. */
  currentTimestamp: string | null;
}

/** The two points a line needs. */
const MIN_POINTS = 2;

/**
 * The Figma "Precio de AAPL": the price of the asset from the day of the decision on, following the
 * replay. It asks for its own data, so it loads and fails without taking the page with it.
 */
export function DecisionPricePanel({
  decision,
  symbol,
  currency,
  currentTimestamp,
}: DecisionPricePanelProps) {
  const { t, i18n } = useTranslation();
  const range = historyRangeOf(decision, new Date());
  const history = useAssetHistory(decision.assetId, range);
  const levels = useMemo(() => priceLevelsOf(decision), [decision]);
  const { points, cursor } = useMemo(
    () => toPriceSeries(history.data ?? [], currentTimestamp),
    [history.data, currentTimestamp],
  );
  const title =
    symbol === null
      ? t("decisions.detail.price.titleNoAsset")
      : t("decisions.detail.price.title", { symbol });

  const levelName = (key: (typeof levels)[number]["key"]) =>
    t(`decisions.detail.indicators.${key}`);
  const summary = [
    cursor === null
      ? null
      : t("decisions.detail.price.caption", {
          date: formatDayMonth(cursor.date, i18n.language),
          price: formatMoney({ amount: String(cursor.close), currency }),
        }),
    ...levels.map((level) => `${levelName(level.key)} ${formatMoney(level.price)}.`),
  ]
    .filter((part) => part !== null)
    .join(" ");

  const body = () => {
    if (history.isPending) {
      return <AnalyticsPanelLoading label={t("decisions.detail.price.loading")} />;
    }
    if (history.isError) {
      return (
        <AnalyticsPanelError
          description={t("decisions.detail.price.failed.description")}
          onRetry={() => {
            void history.refetch();
          }}
          title={t("decisions.detail.price.failed.title")}
        />
      );
    }
    if (points.length < MIN_POINTS) {
      return (
        <p className="text-sm text-(--color-text-secondary)">{t("decisions.detail.price.empty")}</p>
      );
    }
    return (
      <figure className="m-0 flex flex-col gap-4">
        <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-sm text-(--color-text-default)">
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-0.5 w-4 rounded-full bg-(--color-chart-series-1)"
            />
            {t("decisions.detail.price.legend")}
          </li>
          {levels.map((level) => (
            <li className="flex items-center gap-2" key={level.key}>
              <span
                aria-hidden="true"
                className={cn(
                  "w-4 border-t-2 border-dashed",
                  level.key === "target" && "border-(--color-chart-gain)",
                  level.key === "entry" && "border-(--color-text-secondary)",
                  level.key === "stop" && "border-(--color-chart-loss)",
                )}
              />
              {levelName(level.key)}
            </li>
          ))}
        </ul>
        <PriceReplayChart
          currency={currency}
          cursor={cursor}
          label={title}
          levels={levels}
          points={points}
        />
        <figcaption className="sr-only">{summary}</figcaption>
      </figure>
    );
  };

  return (
    <AnalyticsPanel
      subtitle={t("decisions.detail.price.subtitle", {
        from: formatDayMonth(range.from, i18n.language),
        to: formatDayMonth(range.to, i18n.language),
        currency,
      })}
      title={title}
    >
      {body()}
    </AnalyticsPanel>
  );
}
