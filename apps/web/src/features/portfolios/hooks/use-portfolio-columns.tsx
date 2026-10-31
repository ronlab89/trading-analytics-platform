import { createColumnHelper } from "@tanstack/react-table";
import { Check, Tag } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/badge";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { portfolioInitials } from "@/lib/portfolio-initials";
import { PortfolioRowMenu } from "../components/portfolio-row-menu";
import type { PortfolioRow } from "../types";

/** What the row menu can do to a portfolio, by its id. They must be stable, or the columns rebuild. */
export interface PortfolioRowActions {
  onUse: (portfolioId: string) => void;
  onEdit: (portfolioId: string) => void;
  onArchive: (portfolioId: string) => void;
}

const column = createColumnHelper<DataTableFeatures, PortfolioRow>();

/** A header is a component, not a string, so it follows the language without rebuilding the columns. */
function headerOf(key: "name" | "baseCurrency" | "status") {
  return function Header() {
    const { t } = useTranslation();
    return t(`portfolios.columns.${key}`);
  };
}

/** The Figma header of the menu column is blank; screen readers still get a name for it. */
function ActionsHeader() {
  const { t } = useTranslation();
  return <span className="sr-only">{t("portfolios.columns.actions")}</span>;
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
 * portfolio is in use and on the row actions, so they are rebuilt only when those change, which
 * the table needs to stay stable.
 */
export function usePortfolioColumns(activeId: string | undefined, actions: PortfolioRowActions) {
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
              <Link
                className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                to={`/portfolios/${row.original.id}`}
              >
                {row.original.name}
              </Link>
              {row.original.id === activeId ? <Badge>{t("portfolios.inUse")}</Badge> : null}
            </span>
          ),
        }),
        column.accessor("baseCurrency", {
          header: headerOf("baseCurrency"),
          enableGlobalFilter: false,
          // The Figma tablet list drops this column; the desktop one keeps it.
          meta: { align: "center", className: "max-desktop:hidden" },
          cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
        }),
        column.accessor("status", {
          header: headerOf("status"),
          enableSorting: false,
          enableGlobalFilter: false,
          meta: { align: "center" },
          cell: ({ getValue }) => <StatusBadge status={getValue()} />,
        }),
        column.display({
          id: "actions",
          header: ActionsHeader,
          meta: { align: "end" },
          cell: ({ row }) => (
            <PortfolioRowMenu
              inUse={row.original.id === activeId}
              onArchive={actions.onArchive}
              onEdit={actions.onEdit}
              onUse={actions.onUse}
              portfolio={row.original}
            />
          ),
        }),
      ]),
    [activeId, actions, t],
  );
}
