import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { TransactionCardList } from "@/features/transactions/components/transaction-card-list";
import { TransactionsCardsSkeleton } from "@/features/transactions/components/transactions-cards-skeleton";
import { TransactionsPagination } from "@/features/transactions/components/transactions-pagination";
import { TransactionsTable } from "@/features/transactions/components/transactions-table";
import { TransactionsTableSkeleton } from "@/features/transactions/components/transactions-table-skeleton";
import { useTransactionRows } from "@/features/transactions/hooks/use-transaction-rows";
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

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      {isMobile ? (
        <h1 className="text-2xl leading-8 font-semibold text-(--color-text-default)">
          {t("nav.transactions")}
        </h1>
      ) : (
        <h1 className="sr-only">{t("nav.transactions")}</h1>
      )}
      {active !== undefined ? (
        <TransactionsList
          key={active.id}
          isMobile={isMobile}
          portfolioId={active.id}
          portfolioName={active.name}
        />
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
}

function TransactionsList({ portfolioId, portfolioName, isMobile }: TransactionsListProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const transactions = useTransactionRows(portfolioId, { page, pageSize });
  const { rows, meta } = transactions;

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

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
      {isMobile || meta === undefined ? null : (
        <p className="text-sm text-(--color-text-secondary)">
          {t("transactions.summary", { count: meta.total, portfolio: portfolioName })}
        </p>
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
      ) : rows.length === 0 ? (
        <section className="rounded-xl bg-(--color-surface-card) p-6">
          <PortfoliosEmptyState
            description={t(
              isMobile ? "transactions.empty.mobileDescription" : "transactions.empty.description",
            )}
            title={t("transactions.empty.title")}
          />
        </section>
      ) : isMobile ? (
        <div className="overflow-hidden rounded-xl bg-(--color-surface-card)">
          <TransactionCardList rows={rows} />
          <div className="border-t border-(--color-border-default) p-4">{pagination}</div>
        </div>
      ) : (
        <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
          <TransactionsTable rows={rows} />
          {pagination}
        </section>
      )}
    </>
  );
}
