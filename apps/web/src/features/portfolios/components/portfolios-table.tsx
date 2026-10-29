import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTable } from "@/components/data-table/use-data-table";
import { usePortfolioColumns } from "../hooks/use-portfolio-columns";
import type { PortfolioRow } from "../types";

interface PortfoliosTableProps {
  /** Keep it stable (memoized): a new array on every render rebuilds the table. */
  portfolios: readonly PortfolioRow[];
  /** The portfolio the app is working on; its row carries the "In use" tag. */
  activeId: string | undefined;
}

/** The Figma "Lista · Con datos" table: the portfolio columns over the shared `DataTable`. */
export function PortfoliosTable({ portfolios, activeId }: PortfoliosTableProps) {
  const { t } = useTranslation();
  const table = useDataTable({
    columns: usePortfolioColumns(activeId),
    data: portfolios,
    getRowId: (portfolio) => portfolio.id,
    sortable: true,
  });

  return <DataTable aria-label={t("portfolios.table")} table={table} />;
}
