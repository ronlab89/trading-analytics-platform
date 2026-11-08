import { useMutation, useQueryClient } from "@tanstack/react-query";
import { portfolioOperations, type PortfolioResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { portfolioKeys } from "@/hooks/use-portfolios";

const archivePortfolioOperation = findOperation(portfolioOperations, "archivePortfolio");

/**
 * Archives a portfolio by its id and refreshes the list and that portfolio, so every screen shows
 * it as archived. The API is idempotent: archiving one that is already archived answers 200, so
 * that counts as success too. There is no way back (the API has no unarchive), and it sends no
 * `Idempotency-Key` because the endpoint does not take one.
 */
export function useArchivePortfolio() {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["portfolios", "archive"],
    mutationFn: async (portfolioId: string) => {
      const { data } = (await client.call(archivePortfolioOperation, {
        params: { portfolioId },
      })) as { data: PortfolioResponse };
      return data;
    },
    onSuccess: (_portfolio, portfolioId) => {
      void queryClient.invalidateQueries({ queryKey: portfolioKeys.list() });
      void queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
    },
  });
}
