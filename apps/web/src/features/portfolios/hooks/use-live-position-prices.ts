import { useQueryClient } from "@tanstack/react-query";
import type { PositionResponse } from "@trading/contracts";
import { portfolioKeys } from "@/hooks/use-portfolios";
import { useMarketTicks } from "@/hooks/use-market-ticks";
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
  const queryClient = useQueryClient();
  const enabled = portfolioId !== undefined && portfolioId !== "";

  useMarketTicks(
    assetIds,
    (event) => {
      queryClient.setQueryData<readonly PositionResponse[]>(
        portfolioKeys.positions(portfolioId ?? ""),
        (positions) => (positions ? applyPriceToPositions(positions, event) : positions),
      );
    },
    enabled,
  );
}
