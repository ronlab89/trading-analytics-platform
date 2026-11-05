import { useEffect, useEffectEvent } from "react";
import type { MarketPriceUpdatedEvent } from "@/features/watchlist/lib/apply-price-update";
import { useRealtimeClient } from "@/realtime/realtime-client-provider";

/**
 * Calls `onTick` with every price tick of the given assets while the component is mounted: it
 * listens once to the market channel of each distinct asset and leaves them when the assets change
 * or the component unmounts. With `enabled` false it listens to nothing.
 */
export function useMarketTicks(
  assetIds: readonly string[],
  onTick: (event: MarketPriceUpdatedEvent) => void,
  enabled = true,
): void {
  const client = useRealtimeClient();
  const unique = [...new Set(assetIds)];
  const key = unique.join(",");
  const subscribeAll = useEffectEvent(() => {
    if (!enabled) return undefined;
    const leaves = unique.map((assetId) =>
      client.subscribe({ kind: "market", assetId }, (event) => {
        if (event.type === "MARKET_PRICE_UPDATED") onTick(event);
      }),
    );
    return () => {
      leaves.forEach((leave) => {
        leave();
      });
    };
  });

  useEffect(() => subscribeAll(), [client, key, enabled]);
}
