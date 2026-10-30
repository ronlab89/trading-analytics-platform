import { useQuery } from "@tanstack/react-query";
import { portfolioOperations, type PositionResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { portfolioKeys } from "@/hooks/use-portfolios";

const listPositionsOperation = findOperation(portfolioOperations, "listPositions");

/** The positions of one portfolio. It stays idle while the route has no id. */
export function usePositions(portfolioId: string | undefined) {
  const client = useTradingClient();

  return useQuery({
    queryKey: portfolioKeys.positions(portfolioId ?? ""),
    enabled: portfolioId !== undefined && portfolioId !== "",
    queryFn: async () => {
      const { data } = (await client.call(listPositionsOperation, {
        params: { portfolioId: portfolioId ?? "" },
      })) as { data: PositionResponse[] };
      return data;
    },
  });
}
