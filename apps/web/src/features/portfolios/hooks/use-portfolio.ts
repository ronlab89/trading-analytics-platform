import { useQuery } from "@tanstack/react-query";
import { portfolioOperations, type PortfolioResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { portfolioKeys } from "@/hooks/use-portfolios";

const getPortfolioOperation = findOperation(portfolioOperations, "getPortfolio");

/** One portfolio by id. It stays idle while the route has no id, so the view reads `isPending`. */
export function usePortfolio(id: string | undefined) {
  const client = useTradingClient();

  return useQuery({
    queryKey: portfolioKeys.detail(id ?? ""),
    enabled: id !== undefined && id !== "",
    queryFn: async () => {
      const { data } = (await client.call(getPortfolioOperation, {
        params: { portfolioId: id ?? "" },
      })) as { data: PortfolioResponse };
      return data;
    },
  });
}
