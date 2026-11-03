import { useQuery } from "@tanstack/react-query";
import { decisionOperations, type DecisionResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const listDecisionsOperation = findOperation(decisionOperations, "listDecisions");

/** Query keys of the decision data, so a change to a portfolio's decisions can refresh its list. */
export const decisionKeys = {
  all: ["decisions"] as const,
  portfolio: (portfolioId: string) => [...decisionKeys.all, portfolioId] as const,
};

/**
 * The decisions of a portfolio, newest first as the API gives them. The list is not paged: a
 * portfolio holds few decisions. It stays idle while there is no portfolio.
 */
export function useDecisions(portfolioId: string | undefined) {
  const client = useTradingClient();

  return useQuery({
    queryKey: decisionKeys.portfolio(portfolioId ?? ""),
    enabled: portfolioId !== undefined && portfolioId !== "",
    queryFn: async () => {
      const { data } = (await client.call(listDecisionsOperation, {
        params: { portfolioId: portfolioId ?? "" },
      })) as { data: DecisionResponse[] };
      return data;
    },
  });
}
