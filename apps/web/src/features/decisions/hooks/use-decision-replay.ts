import { useQuery } from "@tanstack/react-query";
import { decisionOperations, type DecisionReplayResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { decisionKeys } from "./use-decisions";

const getDecisionReplayOperation = findOperation(decisionOperations, "getDecisionReplay");

/**
 * One decision with its events, in order, and the currency of its asset. It is not nested under a
 * portfolio: the API resolves the owner from the decision. The history never changes, so the answer
 * is the same each time it is asked. It stays idle while there is no decision id.
 */
export function useDecisionReplay(decisionId: string | undefined) {
  const client = useTradingClient();

  return useQuery({
    queryKey: decisionKeys.replay(decisionId ?? ""),
    enabled: decisionId !== undefined && decisionId !== "",
    queryFn: async () => {
      const { data } = (await client.call(getDecisionReplayOperation, {
        params: { decisionId: decisionId ?? "" },
      })) as { data: DecisionReplayResponse };
      return data;
    },
  });
}
