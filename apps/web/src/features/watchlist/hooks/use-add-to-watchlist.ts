import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userOperations } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { watchlistKeys } from "./use-watchlist";

const addToWatchlistOperation = findOperation(userOperations, "addToWatchlist");

/** Adds an asset to the watchlist and refreshes the list. An asset already on it is refused (400). */
export function useAddToWatchlist() {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["watchlist", "add"],
    mutationFn: async (assetId: string) => {
      await client.call(addToWatchlistOperation, { body: { assetId } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: watchlistKeys.all });
    },
  });
}
