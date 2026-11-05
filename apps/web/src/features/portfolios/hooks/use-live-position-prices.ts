import { useQueryClient } from "@tanstack/react-query";
import type { PositionResponse } from "@trading/contracts";
import { useEffect, useEffectEvent } from "react";
import { portfolioKeys } from "@/hooks/use-portfolios";
import { useRealtimeClient } from "@/realtime/realtime-client-provider";
import { applyPriceToPositions } from "../lib/apply-price-to-positions";

/**
 * Keeps the current price of the positions of one portfolio live: it listens to the market channel
 * of each asset while the component is mounted and patches the positions query with every tick.
 * The query still refetches over HTTP (on a resync or while the socket is down). A positions query
 * that has not answered yet has nothing to patch; its own answer will be the latest.
 */
export function useLivePositionPrices(
  portfolioId: string | undefined,
  assetIds: readonly string[],
): void {
  const client = useRealtimeClient();
  const queryClient = useQueryClient();
  const unique = [...new Set(assetIds)];
  const key = `${portfolioId ?? ""}|${unique.join(",")}`;
  const subscribeAll = useEffectEvent(() => {
    if (portfolioId === undefined || portfolioId === "") return undefined;
    const queryKey = portfolioKeys.positions(portfolioId);
    const leaves = unique.map((assetId) =>
      client.subscribe({ kind: "market", assetId }, (event) => {
        if (event.type !== "MARKET_PRICE_UPDATED") return;
        queryClient.setQueryData<readonly PositionResponse[]>(queryKey, (positions) =>
          positions ? applyPriceToPositions(positions, event) : positions,
        );
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
