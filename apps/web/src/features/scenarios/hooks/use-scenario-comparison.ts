import { useQuery } from "@tanstack/react-query";
import {
  MAX_COMPARED_SCENARIOS,
  scenarioOperations,
  type ScenarioComparisonResponse,
} from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { scenarioKeys } from "./use-scenarios";

const compareScenariosOperation = findOperation(scenarioOperations, "compareScenarios");

/** The API compares one to five distinct scenarios; anything else is not asked. */
function canCompare(scenarioIds: readonly string[]) {
  return (
    scenarioIds.length >= 1 &&
    scenarioIds.length <= MAX_COMPARED_SCENARIOS &&
    new Set(scenarioIds).size === scenarioIds.length
  );
}

/**
 * The portfolio as it is against each of the given scenarios. The comparison is a POST that stores
 * nothing, so it is a query: it caches and can be asked again. The order of the ids is the order of
 * the answer (and of the letters the screen gives them), so it is part of the key.
 */
export function useScenarioComparison(portfolioId: string, scenarioIds: readonly string[]) {
  const client = useTradingClient();

  return useQuery({
    queryKey: scenarioKeys.compare(portfolioId, scenarioIds),
    enabled: canCompare(scenarioIds),
    queryFn: async () => {
      const { data } = (await client.call(compareScenariosOperation, {
        params: { portfolioId },
        body: { scenarioIds: [...scenarioIds] },
      })) as { data: ScenarioComparisonResponse };
      return data;
    },
  });
}
