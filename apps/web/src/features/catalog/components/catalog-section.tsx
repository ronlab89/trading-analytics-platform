import { useState } from "react";
import { TransactionsPagination } from "@/features/transactions/components/transactions-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { CatalogFilters } from "../lib/catalog-filters";
import { useCatalogRows } from "../hooks/use-catalog-rows";
import { useToggleWatchlist } from "../hooks/use-toggle-watchlist";
import { CatalogFilterChips } from "./catalog-filter-chips";
import { CatalogFiltersButton } from "./catalog-filters-button";
import { CatalogSearch } from "./catalog-search";
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
  const { rows, meta, canToggle } = useCatalogRows({ page, pageSize }, filters, term);
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

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
      <div className="flex items-center gap-4">
        <CatalogSearch onChange={changeSearch} value={search} />
        <CatalogFiltersButton onApply={changeFilters} value={filters} />
      </div>
      <CatalogFilterChips onChange={changeFilters} value={filters} />
      {rows === undefined || meta === undefined ? null : (
        <>
          <CatalogTable canToggle={canToggle} onToggle={toggle} rows={rows} />
          <TransactionsPagination
            meta={meta}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            shown={rows.length}
          />
        </>
      )}
    </section>
  );
}
