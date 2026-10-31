import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NewPortfolioDialog } from "@/features/portfolios/components/new-portfolio-dialog";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { PortfoliosTableSkeleton } from "@/features/portfolios/components/portfolios-table-skeleton";
import { usePortfolioColumns } from "@/features/portfolios/hooks/use-portfolio-columns";
import type { PortfolioRow } from "@/features/portfolios/types";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { usePortfolios } from "@/hooks/use-portfolios";

const NO_PORTFOLIOS: PortfolioRow[] = [];
const PAGE_SIZE = 10;

/**
 * The portfolio list and its five Figma states: loading, with data, empty, no results for the
 * search, and failed. A refetch that fails keeps showing the data it already has. The table, its
 * search and its sorting are the shared `DataTable` pieces over one table instance.
 */
export function PortfoliosPage() {
  const { t } = useTranslation();
  const { data: portfolios, isError, refetch } = usePortfolios();
  const { active } = useActivePortfolio();
  const table = useDataTable({
    columns: usePortfolioColumns(active?.id),
    data: portfolios ?? NO_PORTFOLIOS,
    getRowId: (portfolio) => portfolio.id,
    sortable: true,
    pageSize: PAGE_SIZE,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const openDialog = () => {
    setDialogOpen(true);
  };

  const matches = table.getRowCount();
  const search = String(table.state.globalFilter ?? "").trim();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="sr-only">{t("nav.portfolios")}</h1>
      <div className="flex items-center justify-between gap-4">
        {portfolios === undefined ? null : (
          <p className="text-sm text-(--color-text-secondary)">
            {t("portfolios.summary", { count: portfolios.length })}
          </p>
        )}
        <Button className="ml-auto" onClick={openDialog}>
          <Plus aria-hidden="true" />
          {t("portfolios.new")}
        </Button>
      </div>
      <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
        {portfolios === undefined && isError ? (
          <Alert
            action={
              <Button
                onClick={() => {
                  void refetch();
                }}
                size="sm"
                variant="outline"
              >
                {t("portfolios.failed.retry")}
              </Button>
            }
            description={t("portfolios.failed.description")}
            title={t("portfolios.failed.title")}
            tone="error"
          />
        ) : portfolios === undefined ? (
          <>
            <DataTableToolbar disabled searchLabel={t("portfolios.search")} table={table}>
              <Skeleton className="h-4 w-18" />
            </DataTableToolbar>
            <PortfoliosTableSkeleton />
          </>
        ) : portfolios.length === 0 ? (
          <PortfoliosEmptyState
            action={
              <Button onClick={openDialog} size="sm" variant="outline">
                {t("portfolios.empty.action")}
              </Button>
            }
            description={t("portfolios.empty.description")}
            title={t("portfolios.empty.title")}
          />
        ) : (
          <>
            <DataTableToolbar searchLabel={t("portfolios.search")} table={table}>
              <p className="text-sm text-(--color-text-secondary)">
                {t("portfolios.count", { count: matches })}
              </p>
            </DataTableToolbar>
            <DataTable aria-label={t("portfolios.table")} table={table} />
            {matches === 0 ? (
              <PortfoliosEmptyState
                action={
                  <Button
                    onClick={() => {
                      table.setGlobalFilter("");
                    }}
                    size="sm"
                    variant="outline"
                  >
                    {t("portfolios.noResults.clear")}
                  </Button>
                }
                description={t("portfolios.noResults.description", { query: search })}
                title={t("portfolios.noResults.title")}
              />
            ) : null}
            <DataTablePagination table={table} />
          </>
        )}
      </section>
      <NewPortfolioDialog onOpenChange={setDialogOpen} open={dialogOpen} />
    </div>
  );
}
