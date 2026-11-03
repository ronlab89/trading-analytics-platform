import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useDecisionReplay } from "./use-decision-replay";

function clientAnswering(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  return { client: { call } as TradingClient, call };
}

describe("useDecisionReplay", () => {
  it("gets the decision with its events through getDecisionReplay, by decision only", async () => {
    const replay = { decision: { id: "d1" }, events: [], currency: "USD", initialState: {} };
    const { client, call } = clientAnswering(() => Promise.resolve({ data: replay }));
    const { result } = renderHook(() => useDecisionReplay("d1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(replay);
    expect(call.mock.calls[0]?.[0].operationId).toBe("getDecisionReplay");
    expect(call.mock.calls[0]?.[1]).toEqual({ params: { decisionId: "d1" } });
  });

  it("reports a failure", async () => {
    const { client } = clientAnswering(() =>
      Promise.reject(new ApiError("NOT_FOUND", "No such decision")),
    );
    const { result } = renderHook(() => useDecisionReplay("d1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("stays idle without a decision id", () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: {} }));
    renderHook(() => useDecisionReplay(undefined), { wrapper: tradingClientWrapper(client) });

    expect(call).not.toHaveBeenCalled();
  });
});
