import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceChangeBadge } from "@/features/watchlist/components/price-change-badge";
import { formatMoney } from "@/lib/format-number";
import type { ScenarioRow } from "../types";

/**
 * The text that says what a scenario changes: the price of its main asset. The name of an asset
 * that is not known is left out instead of hiding the change.
 */
export function useMainChangeLabel() {
  const { t } = useTranslation();

  return (row: Pick<ScenarioRow, "mainChange">) => {
    if (row.mainChange === null) return t("scenarios.variable.none");
    return row.mainChange.symbol === null
      ? t("scenarios.variable.priceUnknown")
      : t("scenarios.variable.price", { symbol: row.mainChange.symbol });
  };
}

/** The main variable as a quiet chip, with the count of the other changes next to it. */
export function ScenarioVariableChip({ row }: { row: ScenarioRow }) {
  const { t } = useTranslation();
  const label = useMainChangeLabel();

  return (
    <span className="flex items-center gap-1">
      <Badge>{label(row)}</Badge>
      {row.otherChanges > 0 ? (
        <span className="text-xs font-medium text-(--color-text-secondary)">
          {t("scenarios.variable.more", { count: row.otherChanges })}
        </span>
      ) : null}
    </span>
  );
}

/**
 * One figure of a scenario that comes from its calculation. While the calculation is on its way the
 * place is held by a block, and when it failed it is a dash, each with the words for a screen reader,
 * so the row is never empty and never made up.
 */
export function ScenarioFigure({
  row,
  children,
}: {
  row: Pick<ScenarioRow, "figures" | "figuresState">;
  children: (figures: NonNullable<ScenarioRow["figures"]>) => React.ReactNode;
}) {
  const { t } = useTranslation();

  if (row.figures !== null) return children(row.figures);
  if (row.figuresState === "failed") {
    return (
      <span>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("scenarios.figures.failed")}</span>
      </span>
    );
  }
  return (
    <span>
      <Skeleton aria-hidden="true" className="inline-block h-4 w-16 align-middle" />
      <span className="sr-only">{t("scenarios.figures.loading")}</span>
    </span>
  );
}

/** What the scenario does to the value of the portfolio, as the green or red badge of the watchlist. */
export function ScenarioImpact({ row }: { row: ScenarioRow }) {
  return (
    <ScenarioFigure row={row}>
      {(figures) => <PriceChangeBadge percent={figures.impactPercent} />}
    </ScenarioFigure>
  );
}

/** The value of the portfolio with the scenario applied. */
export function ScenarioValue({ row }: { row: ScenarioRow }) {
  return (
    <ScenarioFigure row={row}>
      {(figures) => <span className="font-medium">{formatMoney(figures.withScenario)}</span>}
    </ScenarioFigure>
  );
}
