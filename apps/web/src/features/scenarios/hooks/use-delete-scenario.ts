import { useMutation, useQueryClient } from "@tanstack/react-query";
import { scenarioOperations } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { scenarioKeys } from "./use-scenarios";

const deleteScenarioOperation = findOperation(scenarioOperations, "deleteScenario");

/**
 * Deletes a scenario of the portfolio and refreshes the list. The list is refreshed on its own
 * (`exact`), not with the calculations of the other scenarios, which the deletion does not touch;
 * the calculation of the deleted one is dropped. A refusal changes nothing in the cache.
 */
export function useDeleteScenario(portfolioId: string) {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["scenarios", "delete"],
    mutationFn: async (scenarioId: string) => {
      await client.call(deleteScenarioOperation, { params: { portfolioId, scenarioId } });
    },
    onSuccess: (_result, scenarioId) => {
      void queryClient.invalidateQueries({
        queryKey: scenarioKeys.portfolio(portfolioId),
        exact: true,
      });
      queryClient.removeQueries({ queryKey: scenarioKeys.impact(portfolioId, scenarioId) });
    },
  });
}
