import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Avatar } from "@/components/avatar";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { formatMoney } from "@/lib/format-number";
import { DecisionDirectionBadge, DecisionStatusBadge } from "../components/decision-badges";
import type { DecisionRow } from "../types";

const column = createColumnHelper<DataTableFeatures, DecisionRow>();

type ColumnKey = "name" | "direction" | "entry" | "target" | "stop" | "status" | "outcome";

/** The tablet drops the prices, which are the most detail; the mobile cards show the rest. */
const DESKTOP_ONLY = "max-desktop:hidden";

/** A header is a component, not a string, so it follows the language without rebuilding the columns. */
function headerOf(key: ColumnKey) {
  return function Header() {
    const { t } = useTranslation();
    return t(`decisions.columns.${key}`);
  };
}

/** The title is the link that opens the decision, the way the portfolios open theirs. */
function NameCell({ id, title, symbol }: Pick<DecisionRow, "id" | "title" | "symbol">) {
  return (
    <span className="flex items-center gap-3">
      <Avatar initials={symbol ?? "—"} shape="square" size="lg" />
      <Link
        className="rounded-sm font-medium text-(--color-text-default) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        to={`/decisions/${id}`}
      >
        {title}
      </Link>
    </span>
  );
}

/** A price the decision does not set is a dash, not a zero. */
function Price({ price }: { price: DecisionRow["entryPrice"] }) {
  return <span className="font-medium">{price === null ? "—" : formatMoney(price)}</span>;
}

/** What the sort reads of a price: the number, and a decision without one goes last either way. */
const amountOf = (price: DecisionRow["entryPrice"]) =>
  price === null ? undefined : Number(price.amount);

/**
 * The columns of the decisions table, as the Figma draws them. The list is loaded whole, so the
 * columns sort in the client. The search reads the name column, which holds the title and the
 * asset's name and symbol, so it finds a decision by any of them. Nothing depends on the data, so
 * the columns are built once, which the table needs to stay stable.
 */
export function useDecisionColumns() {
  return useMemo(
    () =>
      column.columns([
        column.accessor((row) => `${row.title} ${row.name ?? ""} ${row.symbol ?? ""}`.trim(), {
          id: "name",
          header: headerOf("name"),
          meta: { rowHeader: true },
          cell: ({ row }) => (
            <NameCell
              id={row.original.id}
              symbol={row.original.symbol}
              title={row.original.title}
            />
          ),
        }),
        column.accessor("direction", {
          header: headerOf("direction"),
          enableGlobalFilter: false,
          cell: ({ getValue }) => <DecisionDirectionBadge direction={getValue()} />,
        }),
        column.accessor((row) => amountOf(row.entryPrice), {
          id: "entry",
          header: headerOf("entry"),
          enableGlobalFilter: false,
          sortUndefined: "last",
          meta: { align: "end", className: DESKTOP_ONLY },
          cell: ({ row }) => <Price price={row.original.entryPrice} />,
        }),
        column.accessor((row) => amountOf(row.targetPrice), {
          id: "target",
          header: headerOf("target"),
          enableGlobalFilter: false,
          sortUndefined: "last",
          meta: { align: "end", className: DESKTOP_ONLY },
          cell: ({ row }) => <Price price={row.original.targetPrice} />,
        }),
        column.accessor((row) => amountOf(row.stopPrice), {
          id: "stop",
          header: headerOf("stop"),
          enableGlobalFilter: false,
          sortUndefined: "last",
          meta: { align: "end", className: DESKTOP_ONLY },
          cell: ({ row }) => <Price price={row.original.stopPrice} />,
        }),
        column.accessor("status", {
          header: headerOf("status"),
          enableGlobalFilter: false,
          cell: ({ getValue }) => <DecisionStatusBadge status={getValue()} />,
        }),
        column.accessor((row) => row.outcome ?? "", {
          id: "outcome",
          header: headerOf("outcome"),
          enableGlobalFilter: false,
          meta: { align: "end" },
          cell: ({ row }) => <span className="font-medium">{row.original.outcome ?? "—"}</span>,
        }),
      ]),
    [],
  );
}
