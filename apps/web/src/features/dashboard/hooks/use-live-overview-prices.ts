import { useQueryClient } from "@tanstack/react-query";
import type { OverviewResponse } from "@trading/contracts";
import { useMarketTicks } from "@/hooks/use-market-ticks";
import { applyPriceToOverview } from "../lib/apply-price-to-overview";
import { overviewKeys } from "./use-overview";

/**
 * Keeps the prices, the metrics of the positions and the summary of a portfolio overview live: it
 * listens to the market channel of each asset while the component is mounted and patches the
 * overview query with every tick. An overview that has not answered yet has nothing to patch.
 */
export function useLiveOverviewPrices(
  portfolioId: string | undefined,
  assetIds: readonly string[],
): void {
  const queryClient = useQueryClient();
  const enabled = portfolioId !== undefined && portfolioId !== "";

  useMarketTicks(
    assetIds,
    (event) => {
      queryClient.setQueryData<OverviewResponse>(
        overviewKeys.portfolio(portfolioId ?? ""),
        (overview) => (overview ? applyPriceToOverview(overview, event) : overview),
      );
    },
    enabled,
  );
}
