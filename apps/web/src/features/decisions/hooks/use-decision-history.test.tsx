import type { DecisionResponse } from "@trading/contracts";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useDecisionHistory } from "./use-decision-history";

const decision = {
  assetId: "a1",
  createdAt: "2026-08-12T10:05:00.000Z",
  closedAt: "2026-09-20T09:00:00.000Z",
} as DecisionResponse;

function clientAnswering(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  return { client: { call } as TradingClient, call };
}

describe("useDecisionHistory", () => {
  it("asks for the days of the decision, from the day it was made to the day it closed", async () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: [] }));
    const { result } = renderHook(() => useDecisionHistory(decision), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.history.isSuccess).toBe(true);
    });
    expect(result.current.range).toEqual({ from: "2026-08-12", to: "2026-09-20" });
    expect(call.mock.calls[0]?.[0].operationId).toBe("getAssetHistory");
    expect(call.mock.calls[0]?.[1]).toEqual({
      params: { assetId: "a1" },
      query: { from: "2026-08-12", to: "2026-09-20", interval: "1d" },
    });
  });

  it("is one request when two panels of the page ask for the same decision", async () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: [{ assetId: "a1" }] }));
    function Panel({ name }: { name: string }) {
      const { history } = useDecisionHistory(decision);
      return <p>{`${name}: ${String(history.data?.length ?? "loading")}`}</p>;
    }
    const Wrapper = tradingClientWrapper(client, createQueryClient());

    render(
      <Wrapper>
        <Panel name="price" />
        <Panel name="expected" />
      </Wrapper>,
    );

    expect(await screen.findByText("price: 1")).toBeInTheDocument();
    expect(await screen.findByText("expected: 1")).toBeInTheDocument();
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("keeps the same range while the page is open, even when the decision object changes", () => {
    const { client } = clientAnswering(() => Promise.resolve({ data: [] }));
    const { result, rerender } = renderHook(({ current }) => useDecisionHistory(current), {
      initialProps: { current: { ...decision, closedAt: null } },
      wrapper: tradingClientWrapper(client),
    });
    const first = result.current.range;

    rerender({ current: { ...decision, closedAt: null } });

    expect(result.current.range).toBe(first);
  });
});
