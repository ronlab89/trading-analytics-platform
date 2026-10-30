import { renderHook, waitFor } from "@testing-library/react";
import type { AssetResponse, PositionResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { usePositionRows } from "./use-position-rows";

function position(id: string, assetId: string): PositionResponse {
  return {
    id,
    portfolioId: "p1",
    assetId,
    quantity: 236,
    averageEntryPrice: { amount: "162.40", currency: "USD" },
    currentPrice: { amount: "180.70", currency: "USD" },
    openedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  };
}

function asset(id: string, symbol: string, name: string): AssetResponse {
  return {
    id,
    symbol,
    name,
    assetType: "STOCK",
    currency: "USD",
    exchange: "NASDAQ",
    status: "ACTIVE",
    metadata: {},
  };
}

const assets = new Map([
  ["a1", asset("a1", "AAPL", "Apple Inc.")],
  ["a2", asset("a2", "MSFT", "Microsoft")],
]);

interface Answers {
  positions?: () => Promise<unknown>;
  asset?: (assetId: string) => Promise<unknown>;
}

function clientWith({ positions, asset: assetAnswer }: Answers) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      if (operation.operationId === "listPositions") {
        return (
          positions?.() ?? Promise.resolve({ data: [position("s1", "a1"), position("s2", "a2")] })
        );
      }
      const assetId = input?.params?.assetId ?? "";
      return assetAnswer ? assetAnswer(assetId) : Promise.resolve({ data: assets.get(assetId) });
    },
  );
  return { client: { call } as TradingClient, call };
}

function renderRows(answers: Answers = {}) {
  const { client, call } = clientWith(answers);
  const hook = renderHook(() => usePositionRows("p1"), { wrapper: tradingClientWrapper(client) });
  return { ...hook, call };
}

describe("usePositionRows", () => {
  it("joins each position with the symbol and name of its asset", async () => {
    const { result } = renderRows();

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.rows).toEqual([
      {
        id: "s1",
        symbol: "AAPL",
        name: "Apple Inc.",
        quantity: 236,
        averageEntryPrice: { amount: "162.40", currency: "USD" },
        currentPrice: { amount: "180.70", currency: "USD" },
      },
      {
        id: "s2",
        symbol: "MSFT",
        name: "Microsoft",
        quantity: 236,
        averageEntryPrice: { amount: "162.40", currency: "USD" },
        currentPrice: { amount: "180.70", currency: "USD" },
      },
    ]);
  });

  it("stays pending until the assets arrive, so no row flashes an unknown name", async () => {
    const { result, call } = renderRows({ asset: () => new Promise(() => undefined) });

    await waitFor(() => {
      expect(call).toHaveBeenCalledWith(
        expect.objectContaining({ operationId: "getAsset" }),
        expect.anything(),
      );
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.rows).toBeUndefined();
  });

  it("keeps the row of an asset that could not be loaded, without a symbol or name", async () => {
    const { result } = renderRows({
      asset: (assetId) =>
        assetId === "a1"
          ? Promise.resolve({ data: assets.get("a1") })
          : Promise.reject(new ApiError("NOT_FOUND", "Asset not found", 404)),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.isError).toBe(false);
    expect(result.current.rows?.[0]).toMatchObject({ symbol: "AAPL", name: "Apple Inc." });
    expect(result.current.rows?.[1]).toMatchObject({ id: "s2", symbol: null, name: null });
  });

  it("is an empty list, without asking for any asset, when the portfolio has no positions", async () => {
    const { result, call } = renderRows({ positions: () => Promise.resolve({ data: [] }) });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.rows).toEqual([]);
    expect(
      call.mock.calls.filter(([operation]) => operation.operationId === "getAsset"),
    ).toHaveLength(0);
  });

  it("reports a failed positions request and retries it on demand", async () => {
    let fail = true;
    const { result } = renderRows({
      positions: () =>
        fail
          ? Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503))
          : Promise.resolve({ data: [position("s1", "a1")] }),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.rows).toBeUndefined();

    fail = false;
    void result.current.refetch();

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(result.current.isError).toBe(false);
  });

  it("returns the same rows between renders while nothing changed, so a table can rely on them", async () => {
    const { result, rerender } = renderRows();
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    const before = result.current.rows;
    rerender();

    expect(result.current.rows).toBe(before);
  });
});
