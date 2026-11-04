import { useQuery } from "@tanstack/react-query";
import { scenarioOperations, type ScenarioResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const listScenariosOperation = findOperation(scenarioOperations, "listScenarios");

/** Query keys of the scenario data, so a change to a scenario can refresh the list and its figures. */
export const scenarioKeys = {
  all: ["scenarios"] as const,
  portfolio: (portfolioId: string) => [...scenarioKeys.all, portfolioId] as const,
  detail: (portfolioId: string, scenarioId: string) =>
    [...scenarioKeys.all, portfolioId, "detail", scenarioId] as const,
  impact: (portfolioId: string, scenarioId: string) =>
    [...scenarioKeys.all, portfolioId, "impact", scenarioId] as const,
};

/**
 * The scenarios of a portfolio. The list is not paged: a portfolio holds few scenarios. It stays
 * idle while there is no portfolio.
 */
export function useScenarios(portfolioId: string | undefined) {
  const client = useTradingClient();

  return useQuery({
    queryKey: scenarioKeys.portfolio(portfolioId ?? ""),
    enabled: portfolioId !== undefined && portfolioId !== "",
    queryFn: async () => {
      const { data } = (await client.call(listScenariosOperation, {
        params: { portfolioId: portfolioId ?? "" },
      })) as { data: ScenarioResponse[] };
      return data;
    },
  });
}
