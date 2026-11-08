import { useQuery } from "@tanstack/react-query";
import { analyticsOperations, type OverviewResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const getOverviewOperation = findOperation(analyticsOperations, "getPortfolioOverview");

/** Query keys of the dashboard data, so a change to a portfolio can invalidate its overview. */
export const overviewKeys = {
  all: ["overview"] as const,
  portfolio: (portfolioId: string) => [...overviewKeys.all, portfolioId] as const,
};

/**
 * The overview of a portfolio: one read model with everything the dashboard draws (summary,
 * positions, allocation, performance, pulse, recent transactions), so the screen makes a single
 * request. It stays idle while there is no portfolio.
 */
export function useOverview(portfolioId: string | undefined) {
  const client = useTradingClient();

  return useQuery({
    queryKey: overviewKeys.portfolio(portfolioId ?? ""),
    enabled: portfolioId !== undefined && portfolioId !== "",
    queryFn: async () => {
      const { data } = (await client.call(getOverviewOperation, {
        params: { portfolioId: portfolioId ?? "" },
      })) as { data: OverviewResponse };
      return data;
    },
  });
}
