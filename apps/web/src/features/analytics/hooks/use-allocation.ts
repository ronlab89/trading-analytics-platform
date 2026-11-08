import { useQuery } from "@tanstack/react-query";
import {
  analyticsOperations,
  type AllocationGroupBy,
  type AllocationResponse,
} from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { analyticsKeys } from "./analytics-keys";

const getAllocationOperation = findOperation(analyticsOperations, "getPortfolioAllocation");

/**
 * How a portfolio's market value is split today, by asset, by asset type or by currency. It is the
 * current state, so it does not depend on the period. It stays idle while there is no portfolio.
 */
export function useAllocation(portfolioId: string | undefined, groupBy: AllocationGroupBy) {
  const client = useTradingClient();

  return useQuery({
    queryKey: [...analyticsKeys.portfolio(portfolioId ?? ""), "allocation", groupBy],
    enabled: portfolioId !== undefined && portfolioId !== "",
    queryFn: async () => {
      const { data } = (await client.call(getAllocationOperation, {
        params: { portfolioId: portfolioId ?? "" },
        query: { groupBy },
      })) as { data: AllocationResponse };
      return data;
    },
  });
}
