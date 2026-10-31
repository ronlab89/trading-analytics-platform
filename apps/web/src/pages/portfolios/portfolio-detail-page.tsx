import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { ApiError } from "@/api/trading-client";
import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { useDataTable } from "@/components/data-table/use-data-table";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { PositionsTableSkeleton } from "@/features/portfolios/components/positions-table-skeleton";
import { usePortfolio } from "@/features/portfolios/hooks/use-portfolio";
import { usePositionColumns } from "@/features/portfolios/hooks/use-position-columns";
import { usePositionRows } from "@/features/portfolios/hooks/use-position-rows";
import type { PositionRow } from "@/features/portfolios/types";
import { NotFoundPage } from "@/pages/not-found/not-found-page";

const NO_POSITIONS: PositionRow[] = [];
const PAGE_SIZE = 10;

/**
 * One portfolio and its positions. A portfolio that does not exist gets the global not-found
 * page; a failed positions request stays inside its section, as in the Figma "Error" frame, so
 * the rest of the page keeps showing. The table is the shared `DataTable`, sorted and paged on
 * the client like the portfolio list.
 */
export function PortfolioDetailPage() {
  const { t } = useTranslation();
  const { portfolioId } = useParams();
  const portfolio = usePortfolio(portfolioId);
  const positions = usePositionRows(portfolioId);
  const table = useDataTable({
    columns: usePositionColumns(),
    data: positions.rows ?? NO_POSITIONS,
    getRowId: (row) => row.id,
    sortable: true,
    pageSize: PAGE_SIZE,
  });

  if (portfolio.error instanceof ApiError && portfolio.error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="sr-only">{portfolio.data?.name ?? t("nav.portfolios")}</h1>
      <Link
        className="inline-flex items-center gap-2 self-start text-sm text-(--color-text-default)"
        to="/portfolios"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("portfolioDetail.back")}
      </Link>
      {portfolio.isError ? (
        <Alert
          action={
            <Button
              onClick={() => {
                void portfolio.refetch();
              }}
              size="sm"
              variant="outline"
            >
              {t("portfolioDetail.failed.retry")}
            </Button>
          }
          description={t("portfolioDetail.failed.description")}
          title={t("portfolioDetail.failed.title")}
          tone="error"
        />
      ) : null}
      <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-(--color-text-default)">
            {t("portfolioDetail.positions.title")}
          </h2>
          {positions.rows === undefined ? null : (
            <p className="text-sm text-(--color-text-secondary)">
              {t("portfolioDetail.positions.count", { count: positions.rows.length })}
            </p>
          )}
        </div>
        {positions.isError ? (
          <Alert
            action={
              <Button
                onClick={() => {
                  void positions.refetch();
                }}
                size="sm"
                variant="outline"
              >
                {t("portfolioDetail.positions.failed.retry")}
              </Button>
            }
            description={t("portfolioDetail.positions.failed.description")}
            title={t("portfolioDetail.positions.failed.title")}
            tone="error"
          />
        ) : positions.rows === undefined ? (
          <PositionsTableSkeleton />
        ) : positions.rows.length === 0 ? (
          <PortfoliosEmptyState
            description={t("portfolioDetail.positions.empty.description")}
            title={t("portfolioDetail.positions.empty.title")}
          />
        ) : (
          <>
            <DataTable aria-label={t("portfolioDetail.positions.table")} table={table} />
            <DataTablePagination table={table} />
          </>
        )}
      </section>
    </div>
  );
}
