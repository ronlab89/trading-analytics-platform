import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  portfolioOperations,
  type CreatePortfolioRequestBody,
  type PortfolioResponse,
} from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { portfolioKeys } from "@/hooks/use-portfolios";

const createPortfolioOperation = findOperation(portfolioOperations, "createPortfolio");

/**
 * Creates a portfolio and refreshes the list. It sends no `Idempotency-Key`: the API takes it only
 * on transactions and imports, and the HTTP client retries a write that carries one, which could
 * create the portfolio twice here. The dialog blocks a second submit while this is pending.
 */
export function useCreatePortfolio() {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["portfolios", "create"],
    mutationFn: async (body: CreatePortfolioRequestBody) => {
      const { data } = (await client.call(createPortfolioOperation, { body })) as {
        data: PortfolioResponse;
      };
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioKeys.list() });
    },
  });
}
