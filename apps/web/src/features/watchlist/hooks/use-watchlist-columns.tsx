import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/badge";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { exchangeLabel } from "@/lib/exchange-label";
import { formatMoney } from "@/lib/format-number";
import { PriceChangeBadge } from "../components/price-change-badge";
import { WatchlistRemoveButton } from "../components/watchlist-remove-button";
import type { WatchlistRow } from "../types";

const column = createColumnHelper<DataTableFeatures, WatchlistRow>();

type ColumnKey = "asset" | "type" | "exchange" | "price" | "change";

/** A header is a component, not a string, so it follows the language without rebuilding the columns. */
function headerOf(key: ColumnKey) {
  return function Header() {
    const { t } = useTranslation();
    return t(`markets.columns.${key}`);
  };
}

/** The Figma header of the star column is blank; screen readers still get a name for it. */
function ActionsHeader() {
  const { t } = useTranslation();
  return <span className="sr-only">{t("markets.columns.actions")}</span>;
}

function AssetCell({ symbol, name }: Pick<WatchlistRow, "symbol" | "name">) {
  const { t } = useTranslation();

  return (
    <span className="flex items-center gap-3">
      <Avatar initials={symbol ?? "—"} shape="square" size="lg" />
      <span className="max-desktop:max-w-36 max-desktop:truncate">
        {name ?? t("markets.unknownAsset")}
      </span>
    </span>
  );
}

function TypeBadge({ assetType }: Pick<WatchlistRow, "assetType">) {
  const { t } = useTranslation();
  if (assetType === null) return <span aria-hidden="true">—</span>;
  return <Badge>{t(`markets.assetType.${assetType}`)}</Badge>;
}

/**
 * The columns of the watchlist table, as the Figma draws them. The list is loaded whole, so the
 * asset, type, exchange and price sort in the client; today's change does not (the Figma gives it
 * no arrows). The search reads the asset column, which holds the name and the symbol. They depend
 * only on the remove action, which must be stable, or the columns rebuild.
 */
export function useWatchlistColumns(onRemove: (row: WatchlistRow) => void) {
  return useMemo(
    () =>
      column.columns([
        column.accessor((row) => `${row.name ?? ""} ${row.symbol ?? ""}`.trim(), {
          id: "asset",
          header: headerOf("asset"),
          meta: { rowHeader: true },
          cell: ({ row }) => <AssetCell name={row.original.name} symbol={row.original.symbol} />,
        }),
        column.accessor((row) => row.assetType ?? "", {
          id: "type",
          header: headerOf("type"),
          enableGlobalFilter: false,
          cell: ({ row }) => <TypeBadge assetType={row.original.assetType} />,
        }),
        column.accessor((row) => (row.exchange === null ? "" : exchangeLabel(row.exchange)), {
          id: "exchange",
          header: headerOf("exchange"),
          enableGlobalFilter: false,
        }),
        column.accessor((row) => (row.price === null ? undefined : Number(row.price.amount)), {
          id: "price",
          header: headerOf("price"),
          enableGlobalFilter: false,
          meta: { align: "end" },
          cell: ({ row }) => (
            <span className="font-medium">
              {row.original.price === null ? "—" : formatMoney(row.original.price)}
            </span>
          ),
        }),
        column.accessor("changePercent", {
          id: "change",
          header: headerOf("change"),
          enableSorting: false,
          enableGlobalFilter: false,
          meta: { align: "end" },
          cell: ({ getValue }) => <PriceChangeBadge percent={getValue()} />,
        }),
        column.display({
          id: "actions",
          header: ActionsHeader,
          meta: { align: "end" },
          cell: ({ row }) => <WatchlistRemoveButton onRemove={onRemove} row={row.original} />,
        }),
      ]),
    [onRemove],
  );
}
