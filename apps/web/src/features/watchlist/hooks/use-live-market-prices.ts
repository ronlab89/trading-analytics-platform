import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { MarketPriceResponse, RealtimeEvent } from "@trading/contracts";
import { useEffect, useEffectEvent } from "react";
import { useRealtimeClient } from "@/realtime/realtime-client-provider";
import { applyPriceUpdate } from "../lib/apply-price-update";
import { marketPriceKeys } from "./use-market-prices";

/** Puts the new price in every price query that asked for that asset, and in no other. */
function patchPrices(queryClient: QueryClient, event: RealtimeEvent) {
  if (event.type !== "MARKET_PRICE_UPDATED") return;
  const { assetId } = event.payload;
  queryClient.setQueriesData<ReadonlyMap<string, MarketPriceResponse>>(
    {
      queryKey: marketPriceKeys.all,
      predicate: ({ queryKey }) => (queryKey[1] as readonly string[]).includes(assetId),
    },
    // A query that has not answered yet has nothing to patch; its own answer will be the latest.
    (prices) => (prices ? applyPriceUpdate(prices, event) : prices),
  );
}

/**
 * Keeps the prices of the given assets live: it listens to the market channel of each one while the
 * component is mounted and patches the price queries with every tick. The queries still refetch
 * over HTTP (on a resync or while the socket is down), and a tick never takes a fresher snapshot
 * back to an older price.
 */
export function useLiveMarketPrices(assetIds: readonly string[]): void {
  const client = useRealtimeClient();
  const queryClient = useQueryClient();
  const key = assetIds.join(",");
  const subscribeAll = useEffectEvent(() => {
    const leaves = assetIds.map((assetId) =>
      client.subscribe({ kind: "market", assetId }, (event) => {
        patchPrices(queryClient, event);
      }),
    );
    return () => {
      leaves.forEach((leave) => {
        leave();
      });
    };
  });

  useEffect(() => subscribeAll(), [client, key]);
}
