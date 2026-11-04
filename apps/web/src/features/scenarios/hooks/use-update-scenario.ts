import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  scenarioOperations,
  type ScenarioResponse,
  type UpdateScenarioRequestBody,
} from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { scenarioKeys } from "./use-scenarios";

const updateScenarioOperation = findOperation(scenarioOperations, "updateScenario");

/**
 * Changes a scenario: its name, its description, its status (draft or saved) or its changes, which
 * replace the whole list. The scenario in the cache becomes what the API answered, and the list is
 * refreshed on its own. A calculation is derived from the stored changes, so only when the changes
 * are sent are the calculation and the comparisons of the portfolio asked for again; a refusal changes nothing in the cache.
 */
export function useUpdateScenario(portfolioId: string, scenarioId: string) {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["scenarios", "update", scenarioId],
    mutationFn: async (body: UpdateScenarioRequestBody) => {
      const { data } = (await client.call(updateScenarioOperation, {
        params: { portfolioId, scenarioId },
        body,
      })) as { data: ScenarioResponse };
      return data;
    },
    onSuccess: (scenario, body) => {
      queryClient.setQueryData(scenarioKeys.detail(portfolioId, scenarioId), scenario);
      void queryClient.invalidateQueries({
        queryKey: scenarioKeys.portfolio(portfolioId),
        exact: true,
      });
      if (body.changes !== undefined) {
        void queryClient.invalidateQueries({
          queryKey: scenarioKeys.impact(portfolioId, scenarioId),
        });
        void queryClient.invalidateQueries({ queryKey: scenarioKeys.comparisons(portfolioId) });
      }
    },
  });
}
