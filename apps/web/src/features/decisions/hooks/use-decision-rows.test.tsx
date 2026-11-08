import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useDecisionRows } from "./use-decision-rows";

const decision = (id: string, assetId: string, closedAt: string | null = null) => ({
  id,
  portfolioId: "p1",
  assetId,
  title: `Decision ${id}`,
  thesis: "A thesis.",
  direction: "LONG",
  entryPrice: { amount: "150.00", currency: "USD" },
  targetPrice: null,
  stopPrice: null,
  riskLevel: null,
  createdAt: "2026-06-01T14:00:00.000Z",
  closedAt,
  outcome: null,
  notes: null,
});

const apple = { id: "a1", symbol: "AAPL", name: "Apple Inc." };

function clientWith(answers: {
  decisions?: () => Promise<unknown>;
  asset?: (assetId: string) => Promise<unknown>;
}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      if (operation.operationId === "listDecisions") {
        return (
          answers.decisions?.() ??
          Promise.resolve({ data: [decision("d1", "a1"), decision("d2", "a2")] })
        );
      }
      const { assetId } = input?.params as { assetId: string };
      return (
        answers.asset?.(assetId) ??
        (assetId === "a1"
          ? Promise.resolve({ data: apple })
          : Promise.reject(new ApiError("NOT_FOUND", "No such asset")))
      );
    },
  );
  return { client: { call } as TradingClient, call };
}

describe("useDecisionRows", () => {
  it("puts the symbol and name of the asset on each decision once everything is in", async () => {
    const { client, call } = clientWith({});
    const { result } = renderHook(() => useDecisionRows("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    expect(result.current.rows).toBeUndefined();
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(2);
    });
    expect(result.current.rows?.[0]).toMatchObject({
      id: "d1",
      symbol: "AAPL",
      name: "Apple Inc.",
    });
    expect(call.mock.calls[0]?.[1]).toEqual({ params: { portfolioId: "p1" } });
  });

  it("keeps a decision whose asset cannot be loaded, without symbol or name", async () => {
    const { client } = clientWith({});
    const { result } = renderHook(() => useDecisionRows("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(2);
    });
    expect(result.current.rows?.[1]).toMatchObject({ id: "d2", symbol: null, name: null });
    expect(result.current.isError).toBe(false);
  });

  it("marks a decision with a closing date as closed", async () => {
    const { client } = clientWith({
      decisions: () =>
        Promise.resolve({ data: [decision("d1", "a1", "2026-06-20T14:00:00.000Z")] }),
    });
    const { result } = renderHook(() => useDecisionRows("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.rows?.[0]?.status).toBe("CLOSED");
    });
  });

  it("reports a failed request of the decisions", async () => {
    const { client } = clientWith({
      decisions: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
    });
    const { result } = renderHook(() => useDecisionRows("p1"), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.rows).toBeUndefined();
  });

  it("stays idle without a portfolio", () => {
    const { client, call } = clientWith({});
    renderHook(() => useDecisionRows(undefined), { wrapper: tradingClientWrapper(client) });

    expect(call).not.toHaveBeenCalled();
  });
});
