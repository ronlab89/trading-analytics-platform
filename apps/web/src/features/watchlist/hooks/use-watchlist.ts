import { useQuery } from "@tanstack/react-query";
import { userOperations, type WatchlistItemResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const listWatchlistOperation = findOperation(userOperations, "listWatchlist");

/** Query keys of the watchlist, so adding or removing an asset can refresh it. */
export const watchlistKeys = {
  all: ["watchlist"] as const,
};

/** The assets the signed-in user watches. The list is short, so the API sends it whole. */
export function useWatchlist() {
  const client = useTradingClient();

  return useQuery({
    queryKey: watchlistKeys.all,
    queryFn: async () => {
      const { data } = (await client.call(listWatchlistOperation)) as {
        data: WatchlistItemResponse[];
      };
      return data;
    },
  });
}
