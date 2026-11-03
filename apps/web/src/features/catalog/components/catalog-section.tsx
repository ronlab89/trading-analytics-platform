import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { WatchlistCardList } from "@/features/watchlist/components/watchlist-card-list";
import { WatchlistCardsSkeleton } from "@/features/watchlist/components/watchlist-cards-skeleton";
import { WatchlistTableSkeleton } from "@/features/watchlist/components/watchlist-table-skeleton";
import { TransactionsPagination } from "@/features/transactions/components/transactions-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIsMobile } from "@/hooks/use-media-query";
import {
  activeCatalogFilterCount,
  NO_CATALOG_FILTERS,
  type CatalogFilters,
} from "../lib/catalog-filters";
import { useCatalogRows } from "../hooks/use-catalog-rows";
import { useToggleWatchlist } from "../hooks/use-toggle-watchlist";
import { CatalogFilterChips } from "./catalog-filter-chips";
import { CatalogFiltersButton } from "./catalog-filters-button";
import { CatalogSearch } from "./catalog-search";
import { CatalogStarButton } from "./catalog-star-button";
import { CatalogTable } from "./catalog-table";

const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;

interface CatalogSectionProps {
  /** The filters in force; the page keeps them, as its header line counts what they leave. */
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
}

/**
 * The "Todos los activos" tab of Markets: the catalog, paged by the server and narrowed by the
 * search and the filters. The page, its size and the search live here; typing waits for a pause before the request
 * goes out, and a new search or page size starts again on the first page.
 */
export function CatalogSection({ filters, onFiltersChange }: CatalogSectionProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search, SEARCH_DELAY_MS);
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { rows, meta, canToggle, isPending, isError, refetch } = useCatalogRows(
    { page, pageSize },
    filters,
    term,
  );
  const toggle = useToggleWatchlist();

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // Other filters are another list, so it starts on its first page.
  const changeFilters = (next: CatalogFilters) => {
    onFiltersChange(next);
    setPage(1);
  };

  const clearAll = () => {
    changeSearch("");
    changeFilters(NO_CATALOG_FILTERS);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const empty = rows?.length === 0;

  const controls = (
    <>
      <div className="flex items-center gap-4 max-tablet:gap-3">
        <CatalogSearch disabled={isPending} onChange={changeSearch} value={search} />
        <CatalogFiltersButton disabled={isPending} onApply={changeFilters} value={filters} />
      </div>
      <CatalogFilterChips onChange={changeFilters} value={filters} />
    </>
  );

  const noResults = (
    <PortfoliosEmptyState
      action={
        search.trim() !== "" || activeCatalogFilterCount(filters) > 0 ? (
          <Button onClick={clearAll} size="sm" variant="outline">
            {t("markets.catalogNoResults.clear")}
          </Button>
        ) : undefined
      }
      description={t("markets.catalogNoResults.description")}
      title={t("markets.catalogNoResults.title")}
    />
  );

  const failed = (
    <Alert
      action={
        <Button
          onClick={() => {
            void refetch();
          }}
          size="sm"
          variant="outline"
        >
          {t("markets.failed.retry")}
        </Button>
      }
      description={t("markets.catalogFailed.description")}
      title={t("markets.catalogFailed.title")}
      tone="error"
    />
  );

  const pagination =
    meta === undefined || rows === undefined ? null : (
      <TransactionsPagination
        meta={meta}
        onPageChange={setPage}
        onPageSizeChange={changePageSize}
        shown={rows.length}
      />
    );

  // On a phone the search and the filters are outside the card, and the card is the list.
  if (isMobile) {
    return (
      <div className="flex flex-col gap-4">
        {controls}
        {isError ? (
          failed
        ) : isPending ? (
          <WatchlistCardsSkeleton label={t("markets.catalogLoading")} />
        ) : rows === undefined ? null : empty ? (
          <section className="rounded-xl bg-(--color-surface-card) p-6">{noResults}</section>
        ) : (
          <>
            <WatchlistCardList
              label={t("markets.catalogTable")}
              renderAction={(row) => (
                <CatalogStarButton disabled={!canToggle} onToggle={toggle} row={row} />
              )}
              rows={rows}
            />
            <div className="rounded-xl bg-(--color-surface-card) p-4">{pagination}</div>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
      {controls}
      {isError ? (
        failed
      ) : isPending ? (
        <WatchlistTableSkeleton label={t("markets.catalogLoading")} />
      ) : rows === undefined ? null : empty ? (
        noResults
      ) : (
        <>
          <CatalogTable canToggle={canToggle} onToggle={toggle} rows={rows} />
          {pagination}
        </>
      )}
    </section>
  );
}
