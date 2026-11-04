import { useMutation, useQueryClient } from "@tanstack/react-query";
import { scenarioOperations, type ScenarioResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { scenarioKeys } from "./use-scenarios";

const getScenarioOperation = findOperation(scenarioOperations, "getScenario");
const createScenarioOperation = findOperation(scenarioOperations, "createScenario");
const updateScenarioOperation = findOperation(scenarioOperations, "updateScenario");

/**
 * Duplicates a scenario of the portfolio, which the API has no endpoint for: it reads the scenario,
 * creates one with its description and changes under the new name, and saves the copy when the
 * original was saved, since a new scenario starts as a draft. Those are three requests, so the copy
 * can exist when the last one fails: the list is refreshed either way once the copy exists, and the
 * failure still reaches the caller.
 */
export function useDuplicateScenario(portfolioId: string) {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["scenarios", "duplicate"],
    mutationFn: async ({ scenarioId, name }: { scenarioId: string; name: string }) => {
      const { data: source } = (await client.call(getScenarioOperation, {
        params: { portfolioId, scenarioId },
      })) as { data: ScenarioResponse };
      const { data: created } = (await client.call(createScenarioOperation, {
        params: { portfolioId },
        body: {
          name,
          ...(source.description === null ? {} : { description: source.description }),
          changes: source.changes,
        },
      })) as { data: ScenarioResponse };

      try {
        if (source.status !== "SAVED") return created;
        const { data: saved } = (await client.call(updateScenarioOperation, {
          params: { portfolioId, scenarioId: created.id },
          body: { status: "SAVED" },
        })) as { data: ScenarioResponse };
        return saved;
      } finally {
        void queryClient.invalidateQueries({
          queryKey: scenarioKeys.portfolio(portfolioId),
          exact: true,
        });
      }
    },
  });
}
