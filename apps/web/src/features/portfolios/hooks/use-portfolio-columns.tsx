import { createColumnHelper } from "@tanstack/react-table";
import { Check, Tag } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/badge";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { portfolioInitials } from "@/lib/portfolio-initials";
import type { PortfolioRow } from "../types";

const column = createColumnHelper<DataTableFeatures, PortfolioRow>();

/** A header is a component, not a string, so it follows the language without rebuilding the columns. */
function headerOf(key: "name" | "baseCurrency" | "status") {
  return function Header() {
    const { t } = useTranslation();
    return t(`portfolios.columns.${key}`);
  };
}

function StatusBadge({ status }: Pick<PortfolioRow, "status">) {
  const { t } = useTranslation();
  const Icon = status === "ACTIVE" ? Check : Tag;

  return (
    <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>
      <Icon aria-hidden="true" className="size-3.5" />
      {t(`portfolios.status.${status}`)}
    </Badge>
  );
}

/**
 * The columns of the portfolio list, as the Figma draws them, limited to what the list returns:
 * value, daily return and positions need analytics data and arrive with FE2. They depend on which
 * portfolio is in use, so they are rebuilt only when that changes, which the table needs to stay
 * stable.
 */
export function usePortfolioColumns(activeId: string | undefined) {
  const { t } = useTranslation();

  return useMemo(
    () =>
      column.columns([
        column.accessor("name", {
          header: headerOf("name"),
          meta: { rowHeader: true },
          cell: ({ row }) => (
            <span className="flex items-center gap-3">
              <Avatar
                initials={portfolioInitials(row.original.name)}
                shape="square"
                tone={row.original.id === activeId ? "dark" : "neutral"}
              />
              <span>{row.original.name}</span>
              {row.original.id === activeId ? <Badge>{t("portfolios.inUse")}</Badge> : null}
            </span>
          ),
        }),
        column.accessor("baseCurrency", {
          header: headerOf("baseCurrency"),
          meta: { align: "center" },
          cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
        }),
        column.accessor("status", {
          header: headerOf("status"),
          enableSorting: false,
          meta: { align: "center" },
          cell: ({ getValue }) => <StatusBadge status={getValue()} />,
        }),
      ]),
    [activeId, t],
  );
}
