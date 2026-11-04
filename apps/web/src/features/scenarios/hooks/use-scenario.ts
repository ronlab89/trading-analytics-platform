import { useQuery } from "@tanstack/react-query";
import { scenarioOperations, type ScenarioResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { scenarioKeys } from "./use-scenarios";

const getScenarioOperation = findOperation(scenarioOperations, "getScenario");

/** One scenario of a portfolio, with its changes: what the editor works on. */
export function useScenario(portfolioId: string, scenarioId: string) {
  const client = useTradingClient();

  return useQuery({
    queryKey: scenarioKeys.detail(portfolioId, scenarioId),
    queryFn: async () => {
      const { data } = (await client.call(getScenarioOperation, {
        params: { portfolioId, scenarioId },
      })) as { data: ScenarioResponse };
      return data;
    },
  });
}
