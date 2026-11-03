import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import { formatMoney } from "@/lib/format-number";
import type { WatchlistRow } from "../types";
import { PriceChangeBadge } from "./price-change-badge";
import { WatchlistRemoveButton } from "./watchlist-remove-button";

interface WatchlistCardListProps {
  rows: readonly WatchlistRow[];
  onRemove: (row: WatchlistRow) => void;
}

/**
 * The Figma mobile list: a card of rows (symbol, name with its type and exchange under it, price
 * with today's change under it, and the star) instead of a table.
 */
export function WatchlistCardList({ rows, onRemove }: WatchlistCardListProps) {
  const { t } = useTranslation();

  return (
    <ul
      aria-label={t("markets.watchlistTable")}
      className="flex flex-col overflow-hidden rounded-xl bg-(--color-surface-card)"
    >
      {rows.map((row) => {
        const detail = [
          row.assetType === null ? null : t(`markets.assetType.${row.assetType}`),
          row.exchange,
        ]
          .filter((part) => part !== null)
          .join(" · ");

        return (
          <li
            className="flex items-center gap-3 border-b border-(--color-border-default) px-4 py-3 last:border-b-0"
            key={row.assetId}
          >
            <Avatar initials={row.symbol ?? "—"} shape="square" size="lg" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm leading-5 font-medium text-(--color-text-default)">
                {row.name ?? t("markets.unknownAsset")}
              </span>
              <span className="truncate text-xs leading-4 text-(--color-text-secondary)">
                {detail}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm leading-5 font-medium text-(--color-text-default)">
                {row.price === null ? "—" : formatMoney(row.price)}
              </span>
              <PriceChangeBadge percent={row.changePercent} />
            </span>
            <WatchlistRemoveButton onRemove={onRemove} row={row} />
          </li>
        );
      })}
    </ul>
  );
}
