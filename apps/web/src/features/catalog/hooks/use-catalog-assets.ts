import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { marketOperations, type AssetResponse, type PaginationMeta } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { assetKeys } from "@/hooks/use-assets";
import { NO_CATALOG_FILTERS, toCatalogQuery, type CatalogFilters } from "../lib/catalog-filters";

const listAssetsOperation = findOperation(marketOperations, "listAssets");

export interface CatalogPage {
  page: number;
  pageSize: number;
}

/**
 * One page of the active assets, paged by the server and narrowed by the search and the filters.
 * The previous page stays on screen while the next one loads, so paging and typing do not flash
 * the table empty. The term is sent as it is: waiting for the person to stop typing is the
 * caller's job. The order is the API's; the catalog is paginated, so it is not sorted here.
 */
export function useCatalogAssets(
  { page, pageSize }: CatalogPage,
  filters: CatalogFilters = NO_CATALOG_FILTERS,
  term = "",
) {
  const client = useTradingClient();
  const query = toCatalogQuery(filters, term);

  return useQuery({
    queryKey: assetKeys.list(page, pageSize, query),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, meta } = (await client.call(listAssetsOperation, {
        query: { ...query, status: "ACTIVE", page, pageSize },
      })) as { data: AssetResponse[]; meta: PaginationMeta };
      return { assets: data, meta };
    },
  });
}
