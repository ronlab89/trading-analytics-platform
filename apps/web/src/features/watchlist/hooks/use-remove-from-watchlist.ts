import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userOperations } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { watchlistKeys } from "./use-watchlist";

const removeFromWatchlistOperation = findOperation(userOperations, "removeFromWatchlist");

/** Removes an asset from the watchlist and refreshes the list. */
export function useRemoveFromWatchlist() {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["watchlist", "remove"],
    mutationFn: async (assetId: string) => {
      await client.call(removeFromWatchlistOperation, { params: { assetId } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: watchlistKeys.all });
    },
  });
}
