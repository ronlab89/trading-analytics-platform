import { useQuery } from "@tanstack/react-query";
import { scenarioOperations, type ScenarioCalculationResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { scenarioKeys } from "./use-scenarios";

const calculateScenarioOperation = findOperation(scenarioOperations, "calculateScenario");

/**
 * The portfolio with one scenario applied, against the portfolio as it is. The calculation is a
 * POST but it changes nothing and is derived on demand, so it is a query: it caches, and one row of
 * the list can load while the others wait.
 */
export function useScenarioImpact(portfolioId: string, scenarioId: string) {
  const client = useTradingClient();

  return useQuery({
    queryKey: scenarioKeys.impact(portfolioId, scenarioId),
    queryFn: async () => {
      const { data } = (await client.call(calculateScenarioOperation, {
        params: { portfolioId, scenarioId },
      })) as { data: ScenarioCalculationResponse };
      return data;
    },
  });
}
