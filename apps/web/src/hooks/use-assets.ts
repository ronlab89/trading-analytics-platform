import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { marketOperations, type AssetResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const getAssetOperation = findOperation(marketOperations, "getAsset");

/** Query keys of the asset data, so every screen that reads an asset shares its cache entry. */
export const assetKeys = {
  all: ["assets"] as const,
  detail: (id: string) => [...assetKeys.all, "detail", id] as const,
};

/**
 * Defined once, not inline, because TanStack Query reuses the previous result only while the
 * function is the same one; that keeps `assets` the same map until a query actually changes.
 */
function indexAssets(results: UseQueryResult<AssetResponse>[]) {
  return {
    assets: new Map(
      results.flatMap((result) => (result.data ? [[result.data.id, result.data] as const] : [])),
    ),
    isPending: results.some((result) => result.isPending),
    isError: results.some((result) => result.isError),
  };
}

/**
 * The assets behind a list of ids, indexed by id. An id that repeats is asked for once, and one
 * that fails is left out of `assets` and flagged in `isError`, so a view can still draw the rest.
 */
export function useAssets(assetIds: readonly string[]) {
  const client = useTradingClient();
  const ids = [...new Set(assetIds)];

  return useQueries({
    queries: ids.map((id) => ({
      queryKey: assetKeys.detail(id),
      queryFn: async () => {
        const { data } = (await client.call(getAssetOperation, {
          params: { assetId: id },
        })) as { data: AssetResponse };
        return data;
      },
    })),
    combine: indexAssets,
  });
}
