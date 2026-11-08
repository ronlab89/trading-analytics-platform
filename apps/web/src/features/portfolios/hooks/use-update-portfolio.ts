import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  portfolioOperations,
  type PortfolioResponse,
  type UpdatePortfolioRequestBody,
} from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { portfolioKeys } from "@/hooks/use-portfolios";

const updatePortfolioOperation = findOperation(portfolioOperations, "updatePortfolio");

interface UpdatePortfolioInput {
  portfolioId: string;
  body: UpdatePortfolioRequestBody;
}

/**
 * Changes the name or the description of a portfolio (the base currency is fixed after creation)
 * and refreshes the list and that portfolio, so every screen shows the new text. Like the create,
 * it sends no `Idempotency-Key`: the API takes it only on transactions and imports. An archived
 * portfolio answers 409, so callers do not offer the change for one.
 */
export function useUpdatePortfolio() {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["portfolios", "update"],
    mutationFn: async ({ portfolioId, body }: UpdatePortfolioInput) => {
      const { data } = (await client.call(updatePortfolioOperation, {
        params: { portfolioId },
        body,
      })) as { data: PortfolioResponse };
      return data;
    },
    onSuccess: (_portfolio, { portfolioId }) => {
      void queryClient.invalidateQueries({ queryKey: portfolioKeys.list() });
      void queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
    },
  });
}
