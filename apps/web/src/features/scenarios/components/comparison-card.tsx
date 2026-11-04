import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";
import { PriceChangeBadge } from "@/features/watchlist/components/price-change-badge";
import { formatMoney, formatSignedMoney, formatSignedPercent } from "@/lib/format-number";
import type { ComparisonColumn } from "../lib/scenario-comparison";
import { useMainChangeLabel } from "./scenario-parts";

/** The badge of each letter: A and B as the Figma draws them, the rest in the same two colors, solid. */
const LETTER_BADGES = [
  { tone: "info", style: "subtle" },
  { tone: "warning", style: "subtle" },
  { tone: "info", style: "solid" },
  { tone: "warning", style: "solid" },
  { tone: "neutral", style: "solid" },
] as const;

export function letterBadge(letter: string | null) {
  const index = letter === null ? -1 : "ABCDE".indexOf(letter);
  return LETTER_BADGES[index] ?? { tone: "neutral", style: "subtle" };
}

const signedWhole = (percent: number) => `${percent > 0 ? "+" : ""}${String(percent)} %`;

interface ComparisonCardProps {
  column: ComparisonColumn;
  portfolioName: string;
}

/**
 * The Figma card of one column of the comparison: what it is (the base or a scenario, with its
 * letter), the change it makes, and its value, return and profit. A scenario also says how far it
 * moves the value against the base. The "Riesgo" line of the Figma is left out: the API has no risk
 * level for a scenario.
 */
export function ComparisonCard({ column, portfolioName }: ComparisonCardProps) {
  const { t } = useTranslation();
  const mainChangeLabel = useMainChangeLabel();
  const titleId = useId();
  const isBase = column.letter === null;
  const badge = letterBadge(column.letter);

  const subtitle = isBase
    ? t("scenarios.compare.baseSubtitle", { portfolio: portfolioName })
    : column.mainChange === null
      ? t("scenarios.variable.none")
      : `${mainChangeLabel({ mainChange: column.mainChange })} ${signedWhole(column.mainChange.percentChange)}`;

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-xl bg-(--color-surface-card) p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            className="truncate text-base leading-6 font-medium text-(--color-text-default)"
            id={titleId}
          >
            {column.name ?? t("scenarios.compare.base")}
          </h2>
          <p className="text-xs text-(--color-text-secondary)">{subtitle}</p>
        </div>
        <Badge style={badge.style} tone={badge.tone}>
          {isBase
            ? t("scenarios.compare.base")
            : t("scenarios.compare.scenarioLetter", { letter: column.letter ?? "" })}
        </Badge>
      </div>
      <dl className="flex flex-col gap-2 border-t border-(--color-border-default) pt-3 text-sm">
        <Figure label={t("scenarios.compare.value")}>
          <span className="flex items-center gap-2">
            {isBase ? null : <PriceChangeBadge percent={column.valueChangePercent} />}
            <span className="font-medium text-(--color-text-default)">
              {formatMoney(column.value)}
            </span>
          </span>
        </Figure>
        <Figure label={t("scenarios.compare.return")}>
          <span className="font-medium text-(--color-text-default)">
            {formatSignedPercent(column.returnPercent)}
          </span>
        </Figure>
        <Figure label={t("scenarios.compare.profit")}>
          <span className="font-medium text-(--color-text-default)">
            {formatSignedMoney(column.profit)}
          </span>
        </Figure>
      </dl>
    </section>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-(--color-text-secondary)">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
