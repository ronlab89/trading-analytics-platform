import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney, formatQuantity } from "@/lib/format-number";
import { TransactionStatusBadge } from "../components/transaction-status-badge";
import type { TransactionRow } from "../types";

const column = createColumnHelper<DataTableFeatures, TransactionRow>();

type ColumnKey = "date" | "asset" | "type" | "quantity" | "price" | "fees" | "total" | "status";

/** The tablet drops the columns that are the most detail; the mobile cards show the rest. */
const DESKTOP_ONLY = "max-desktop:hidden";

/** A header is a component, not a string, so it follows the language without rebuilding the columns. */
function headerOf(key: ColumnKey) {
  return function Header() {
    const { t } = useTranslation();
    return t(`transactions.columns.${key}`);
  };
}

function AssetCell({ symbol, name }: Pick<TransactionRow, "symbol" | "name">) {
  const { t } = useTranslation();

  return (
    <span className="flex items-center gap-3">
      <Avatar initials={symbol ?? "—"} shape="square" size="lg" />
      <span>{name ?? t("transactions.unknownAsset")}</span>
    </span>
  );
}

function TypeCell({ type }: Pick<TransactionRow, "type">) {
  const { t } = useTranslation();
  return t(`transactions.type.${type}`);
}

/**
 * The columns of the transactions table, as the Figma draws them. The server pages and orders the
 * list, so none of them sorts here. Quantity, price and fees are the ones the tablet drops. Nothing
 * depends on the data, so the columns are built once, which the table needs to stay stable.
 */
export function useTransactionColumns() {
  return useMemo(
    () =>
      column.columns([
        column.accessor("executedAt", {
          id: "date",
          header: headerOf("date"),
          cell: ({ getValue }) => formatDateTime(getValue()),
        }),
        column.accessor((row) => row.name ?? "", {
          id: "asset",
          header: headerOf("asset"),
          meta: { rowHeader: true },
          cell: ({ row }) => <AssetCell name={row.original.name} symbol={row.original.symbol} />,
        }),
        column.accessor("type", {
          header: headerOf("type"),
          cell: ({ getValue }) => <TypeCell type={getValue()} />,
        }),
        column.accessor("quantity", {
          header: headerOf("quantity"),
          meta: { align: "end", className: DESKTOP_ONLY },
          cell: ({ getValue }) => formatQuantity(getValue()),
        }),
        column.accessor((row) => row.price.amount, {
          id: "price",
          header: headerOf("price"),
          meta: { align: "end", className: DESKTOP_ONLY },
          cell: ({ row }) => formatMoney(row.original.price),
        }),
        column.accessor((row) => row.fees.amount, {
          id: "fees",
          header: headerOf("fees"),
          meta: { align: "end", className: DESKTOP_ONLY },
          cell: ({ row }) => formatMoney(row.original.fees),
        }),
        column.accessor((row) => row.total.amount, {
          id: "total",
          header: headerOf("total"),
          meta: { align: "end" },
          cell: ({ row }) => formatMoney(row.original.total),
        }),
        column.accessor("status", {
          header: headerOf("status"),
          meta: { align: "center" },
          cell: ({ getValue }) => <TransactionStatusBadge status={getValue()} />,
        }),
      ]),
    [],
  );
}
