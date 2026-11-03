import { useQuery } from "@tanstack/react-query";
import { marketOperations, type MarketPriceResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const getMarketPricesOperation = findOperation(marketOperations, "getMarketPrices");

/** The most asset ids one `getMarketPrices` request accepts. */
export const MAX_PRICES_PER_REQUEST = 50;

export const marketPriceKeys = {
  all: ["market-prices"] as const,
  assets: (assetIds: readonly string[]) => [...marketPriceKeys.all, assetIds] as const,
};

function inBatches(ids: readonly string[]): string[][] {
  const batches: string[][] = [];
  for (let start = 0; start < ids.length; start += MAX_PRICES_PER_REQUEST) {
    batches.push(ids.slice(start, start + MAX_PRICES_PER_REQUEST));
  }
  return batches;
}

/**
 * The current price of each asset, by asset id. Any number of ids is allowed: they go to the API
 * in batches of up to 50. An asset with no current price is simply missing from the result. It
 * stays idle while there are no ids.
 */
export function useMarketPrices(assetIds: readonly string[]) {
  const client = useTradingClient();

  return useQuery({
    queryKey: marketPriceKeys.assets(assetIds),
    enabled: assetIds.length > 0,
    queryFn: async () => {
      const pages = await Promise.all(
        inBatches(assetIds).map(async (batch) => {
          const { data } = (await client.call(getMarketPricesOperation, {
            query: { assetIds: batch.join(",") },
          })) as { data: MarketPriceResponse[] };
          return data;
        }),
      );
      return new Map(pages.flat().map((price) => [price.assetId, price]));
    },
  });
}
