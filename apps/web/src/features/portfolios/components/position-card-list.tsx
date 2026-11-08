import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import { formatMoney, formatQuantity } from "@/lib/format-number";
import type { PositionRow } from "../types";

interface PositionCardListProps {
  positions: readonly PositionRow[];
}

/**
 * The Figma mobile positions: one card per position (asset, then quantity, average and current
 * price) instead of a table. The value at the right of the name, the unrealized P/L and the
 * allocation need analytics data and arrive with FE2, like the same columns of the table.
 */
export function PositionCardList({ positions }: PositionCardListProps) {
  const { t } = useTranslation();

  return (
    <ul aria-label={t("portfolioDetail.positions.table")} className="flex flex-col gap-3">
      {positions.map((position) => (
        <li
          className="flex flex-col gap-3 rounded-xl bg-(--color-surface-card) p-4"
          key={position.id}
        >
          <div className="flex items-center gap-3">
            <Avatar initials={position.symbol ?? "—"} shape="square" size="lg" />
            <span className="min-w-0 truncate text-base leading-6 font-medium text-(--color-text-default)">
              {position.name ?? t("portfolioDetail.positions.unknownAsset")}
            </span>
          </div>
          <p className="text-xs leading-4 text-(--color-text-secondary)">
            {t("portfolioDetail.positions.mobile.summary", {
              quantity: formatQuantity(position.quantity),
              average: formatMoney(position.averageEntryPrice),
              current: formatMoney(position.currentPrice),
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}
