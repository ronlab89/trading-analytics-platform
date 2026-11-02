import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { NewTransactionPanel } from "@/features/transactions/components/new-transaction-panel";
import { TransactionFilterChips } from "@/features/transactions/components/transaction-filter-chips";
import { TransactionFiltersButton } from "@/features/transactions/components/transaction-filters-button";
import { TransactionCardList } from "@/features/transactions/components/transaction-card-list";
import { TransactionsCardsSkeleton } from "@/features/transactions/components/transactions-cards-skeleton";
import { TransactionsPagination } from "@/features/transactions/components/transactions-pagination";
import { TransactionsTable } from "@/features/transactions/components/transactions-table";
import { TransactionsTableSkeleton } from "@/features/transactions/components/transactions-table-skeleton";
import { useAnnounceRecorded } from "@/features/transactions/hooks/use-announce-recorded";
import { useTransactionRows } from "@/features/transactions/hooks/use-transaction-rows";
import {
  activeFilterCount,
  NO_FILTERS,
  type TransactionFilters,
} from "@/features/transactions/lib/transaction-filters";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { useIsMobile } from "@/hooks/use-media-query";

const DEFAULT_PAGE_SIZE = 10;

/**
 * The transactions of the active portfolio, paged by the server. The page and the size live here,
 * and the portfolio is the `key` of the list, so choosing another portfolio starts again on the
 * first page. The Figma states are all here: loading, with data, empty and failed.
 */
export function TransactionsPage() {
  const { t } = useTranslation();
  const { active, isPending, isError, retry } = useActivePortfolio();
  const isMobile = useIsMobile();
  const [panelOpen, setPanelOpen] = useState(false);
  const announceRecorded = useAnnounceRecorded();
  const openPanel = () => {
    setPanelOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      {isMobile ? (
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl leading-8 font-semibold text-(--color-text-default)">
            {t("nav.transactions")}
          </h1>
          {active !== undefined ? (
            <Button onClick={openPanel} size="sm">
              {t("transactions.newShort")}
            </Button>
          ) : null}
        </div>
      ) : (
        <h1 className="sr-only">{t("nav.transactions")}</h1>
      )}
      {active !== undefined ? (
        <>
          <TransactionsList
            key={active.id}
            isMobile={isMobile}
            onNew={openPanel}
            portfolioId={active.id}
            portfolioName={active.name}
          />
          <NewTransactionPanel
            onOpenChange={setPanelOpen}
            onRecorded={announceRecorded}
            open={panelOpen}
            portfolioId={active.id}
          />
        </>
      ) : isError ? (
        <Alert
          action={
            <Button onClick={retry} size="sm" variant="outline">
              {t("transactions.failed.retry")}
            </Button>
          }
          description={t("transactions.failed.description")}
          title={t("transactions.failed.title")}
          tone="error"
        />
      ) : isPending ? (
        isMobile ? (
          <TransactionsCardsSkeleton />
        ) : (
          <TransactionsTableSkeleton />
        )
      ) : (
        <section className="rounded-xl bg-(--color-surface-card) p-6">
          <PortfoliosEmptyState
            description={t("portfolios.empty.description")}
            title={t("portfolios.empty.title")}
          />
        </section>
      )}
    </div>
  );
}

interface TransactionsListProps {
  portfolioId: string;
  portfolioName: string;
  isMobile: boolean;
  /** Opens the "Nueva transacción" panel, which the page owns. */
  onNew: () => void;
}

function TransactionsList({ portfolioId, portfolioName, isMobile, onNew }: TransactionsListProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState(NO_FILTERS);
  const transactions = useTransactionRows(portfolioId, { page, pageSize }, filters);
  const { rows, meta } = transactions;
  const narrowed = activeFilterCount(filters) > 0;

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  // Another set of filters is another list, so it starts on its first page.
  const changeFilters = (next: TransactionFilters) => {
    setFilters(next);
    setPage(1);
  };

  const toolbar = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <TransactionFiltersButton onApply={changeFilters} value={filters} />
      </div>
      <TransactionFilterChips onChange={changeFilters} value={filters} />
    </div>
  );

  const noResults = (
    <PortfoliosEmptyState
      action={
        <Button
          onClick={() => {
            changeFilters(NO_FILTERS);
          }}
          size="sm"
          variant="outline"
        >
          {t("transactions.noResults.clear")}
        </Button>
      }
      description={t("transactions.noResults.description")}
      title={t("transactions.noResults.title")}
    />
  );

  const pagination =
    meta !== undefined && rows !== undefined ? (
      <TransactionsPagination
        meta={meta}
        onPageChange={setPage}
        onPageSizeChange={changePageSize}
        shown={rows.length}
      />
    ) : null;

  return (
    <>
      {isMobile ? null : (
        <div className="flex items-center justify-between gap-4">
          {meta === undefined ? null : (
            <p className="text-sm text-(--color-text-secondary)">
              {/* With filters, the total is the filtered one, so the history is not given a count. */}
              {narrowed
                ? t("transactions.summaryFiltered", { portfolio: portfolioName })
                : t("transactions.summary", { count: meta.total, portfolio: portfolioName })}
            </p>
          )}
          <Button className="ml-auto" onClick={onNew}>
            <Plus aria-hidden="true" />
            {t("transactions.new")}
          </Button>
        </div>
      )}
      {transactions.isError ? (
        <Alert
          action={
            <Button
              onClick={() => {
                void transactions.refetch();
              }}
              size="sm"
              variant="outline"
            >
              {t("transactions.failed.retry")}
            </Button>
          }
          description={t("transactions.failed.description")}
          title={t("transactions.failed.title")}
          tone="error"
        />
      ) : rows === undefined ? (
        isMobile ? (
          <TransactionsCardsSkeleton />
        ) : (
          <TransactionsTableSkeleton />
        )
      ) : rows.length === 0 && !narrowed ? (
        <section className="rounded-xl bg-(--color-surface-card) p-6">
          <PortfoliosEmptyState
            action={
              <Button onClick={onNew} size="sm" variant="outline">
                {t("transactions.empty.action")}
              </Button>
            }
            description={t(
              isMobile ? "transactions.empty.mobileDescription" : "transactions.empty.description",
            )}
            title={t("transactions.empty.title")}
          />
        </section>
      ) : isMobile ? (
        <>
          {toolbar}
          <div className="overflow-hidden rounded-xl bg-(--color-surface-card)">
            {rows.length === 0 ? (
              <div className="p-6">{noResults}</div>
            ) : (
              <>
                <TransactionCardList rows={rows} />
                <div className="border-t border-(--color-border-default) p-4">{pagination}</div>
              </>
            )}
          </div>
        </>
      ) : (
        <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
          {toolbar}
          {rows.length === 0 ? (
            noResults
          ) : (
            <>
              <TransactionsTable rows={rows} />
              {pagination}
            </>
          )}
        </section>
      )}
    </>
  );
}
