import { useQuery } from "@tanstack/react-query";
import { marketOperations, type HistoricalPriceResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const getAssetHistoryOperation = findOperation(marketOperations, "getAssetHistory");

/** The daily candles of an asset between two calendar days, oldest first. */
export function useAssetHistory(assetId: string, range: { from: string; to: string }) {
  const client = useTradingClient();

  return useQuery({
    queryKey: ["asset-history", assetId, range.from, range.to],
    queryFn: async () => {
      const { data } = (await client.call(getAssetHistoryOperation, {
        params: { assetId },
        query: { ...range, interval: "1d" },
      })) as { data: HistoricalPriceResponse[] };
      return data;
    },
  });
}
