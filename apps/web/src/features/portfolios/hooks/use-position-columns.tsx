import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { formatMoney, formatQuantity } from "@/lib/format-number";
import type { PositionRow } from "../types";

const column = createColumnHelper<DataTableFeatures, PositionRow>();

type ColumnKey = "asset" | "quantity" | "averageEntryPrice" | "currentPrice";

/** A header is a component, not a string, so it follows the language without rebuilding the columns. */
function headerOf(key: ColumnKey) {
  return function Header() {
    const { t } = useTranslation();
    return t(`portfolioDetail.positions.columns.${key}`);
  };
}

function AssetCell({ symbol, name }: Pick<PositionRow, "symbol" | "name">) {
  const { t } = useTranslation();

  return (
    <span className="flex items-center gap-3">
      <Avatar initials={symbol ?? "—"} shape="square" size="lg" />
      <span>{name ?? t("portfolioDetail.positions.unknownAsset")}</span>
    </span>
  );
}

/**
 * The columns of the positions table, as the Figma draws them, limited to what the positions
 * return: value, unrealized P/L and allocation need analytics data and arrive with FE2. The prices
 * sort by their amount, because their text would put "$9.00" after "$100.00". Nothing here depends
 * on the data, so the columns are built once, which the table needs to stay stable; the headers
 * are components, so they follow the language on their own.
 */
export function usePositionColumns() {
  return useMemo(
    () =>
      column.columns([
        column.accessor((row) => row.name ?? "", {
          id: "asset",
          header: headerOf("asset"),
          meta: { rowHeader: true },
          cell: ({ row }) => <AssetCell name={row.original.name} symbol={row.original.symbol} />,
        }),
        column.accessor("quantity", {
          header: headerOf("quantity"),
          meta: { align: "end" },
          cell: ({ getValue }) => formatQuantity(getValue()),
        }),
        column.accessor((row) => Number(row.averageEntryPrice.amount), {
          id: "averageEntryPrice",
          header: headerOf("averageEntryPrice"),
          meta: { align: "end" },
          cell: ({ row }) => formatMoney(row.original.averageEntryPrice),
        }),
        column.accessor((row) => Number(row.currentPrice.amount), {
          id: "currentPrice",
          header: headerOf("currentPrice"),
          meta: { align: "end" },
          cell: ({ row }) => formatMoney(row.original.currentPrice),
        }),
      ]),
    [],
  );
}
