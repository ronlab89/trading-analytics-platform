import { useState } from "react";
import { TransactionsPagination } from "@/features/transactions/components/transactions-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCatalogRows } from "../hooks/use-catalog-rows";
import { useToggleWatchlist } from "../hooks/use-toggle-watchlist";
import { CatalogSearch } from "./catalog-search";
import { CatalogTable } from "./catalog-table";

const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;

/**
 * The "Todos los activos" tab of Markets: the catalog, paged by the server and narrowed by the
 * search. The page, its size and the search live here; typing waits for a pause before the request
 * goes out, and a new search or page size starts again on the first page.
 */
export function CatalogSection() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search, SEARCH_DELAY_MS);
  const { rows, meta, canToggle } = useCatalogRows({ page, pageSize }, undefined, term);
  const toggle = useToggleWatchlist();

  const changeSearch = (value: string) => {
    setSearch(value);
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
      </div>
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
