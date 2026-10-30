import { useQuery } from "@tanstack/react-query";
import { portfolioOperations, type PortfolioResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const listPortfoliosOperation = findOperation(portfolioOperations, "listPortfolios");

/** Query keys of the portfolio data, so a mutation can invalidate exactly what it changed. */
export const portfolioKeys = {
  all: ["portfolios"] as const,
  list: () => [...portfolioKeys.all, "list"] as const,
};

/**
 * The portfolios of the signed-in user. Shared by the shell (the selector) and the portfolio
 * screens, so it lives with the cross-cutting hooks; the view reads `isPending` and `error`.
 */
export function usePortfolios() {
  const client = useTradingClient();

  return useQuery({
    queryKey: portfolioKeys.list(),
    queryFn: async () => {
      const { data } = (await client.call(listPortfoliosOperation)) as {
        data: PortfolioResponse[];
      };
      return data;
    },
  });
}
