import { useMutation, useQueryClient } from "@tanstack/react-query";
import { scenarioOperations, type ScenarioResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { scenarioKeys } from "./use-scenarios";

const createScenarioOperation = findOperation(scenarioOperations, "createScenario");

/**
 * Creates a scenario in the portfolio. The API makes it a draft, and the editor works on drafts, so
 * the scenario is made with just a name and no changes. The list is refreshed on its own, and the
 * new scenario goes into the cache so the editor opens on it without asking again.
 */
export function useCreateScenario(portfolioId: string) {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["scenarios", "create"],
    mutationFn: async (name: string) => {
      const { data } = (await client.call(createScenarioOperation, {
        params: { portfolioId },
        body: { name },
      })) as { data: ScenarioResponse };
      return data;
    },
    onSuccess: (scenario) => {
      queryClient.setQueryData(scenarioKeys.detail(portfolioId, scenario.id), scenario);
      void queryClient.invalidateQueries({
        queryKey: scenarioKeys.portfolio(portfolioId),
        exact: true,
      });
    },
  });
}
