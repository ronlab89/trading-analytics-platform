import { renderHook, waitFor } from "@testing-library/react";
import type { AlertResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useAlertRows } from "./use-alert-rows";

function alert(id: string, assetId: string, createdAt: string): AlertResponse {
  return {
    id,
    userId: "u1",
    assetId,
    portfolioId: null,
    type: "PRICE",
    condition: "ABOVE",
    threshold: 200,
    enabled: true,
    createdAt,
    updatedAt: createdAt,
  };
}

const asset = (id: string, symbol: string, name: string) => ({
  id,
  symbol,
  name,
  assetType: "STOCK",
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
});

const assets = new Map([
  ["a1", asset("a1", "AAPL", "Apple Inc.")],
  ["a2", asset("a2", "MSFT", "Microsoft Corp.")],
]);

interface Answers {
  alerts?: () => Promise<unknown>;
  asset?: (assetId: string) => Promise<unknown>;
}

function render({ alerts, asset: assetAnswer }: Answers = {}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      if (operation.operationId === "listAlerts") {
        return (
          alerts?.() ??
          Promise.resolve({
            data: [
              alert("al1", "a1", "2026-11-01T10:00:00.000Z"),
              alert("al2", "a2", "2026-11-02T10:00:00.000Z"),
            ],
          })
        );
      }
      const id = String(input?.params?.assetId);
      return assetAnswer?.(id) ?? Promise.resolve({ data: assets.get(id) });
    },
  );
  return renderHook(() => useAlertRows(), {
    wrapper: tradingClientWrapper({ call }, createQueryClient()),
  });
}

describe("useAlertRows", () => {
  it("is pending until the alerts and their assets are in", () => {
    const { result } = render();

    expect(result.current.isPending).toBe(true);
    expect(result.current.rows).toBeUndefined();
  });

  it("lists the alerts with their asset, the newest first", async () => {
    const { result } = render();

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.rows?.map(({ id, symbol, name }) => ({ id, symbol, name }))).toEqual([
      { id: "al2", symbol: "MSFT", name: "Microsoft Corp." },
      { id: "al1", symbol: "AAPL", name: "Apple Inc." },
    ]);
  });

  it("is an empty list, not pending, when there are no alerts", async () => {
    const { result } = render({ alerts: () => Promise.resolve({ data: [] }) });

    await waitFor(() => {
      expect(result.current.rows).toEqual([]);
    });
    expect(result.current.isPending).toBe(false);
  });

  it("keeps a row with null fields when its asset fails to load", async () => {
    const { result } = render({
      asset: (id) =>
        id === "a1"
          ? Promise.reject(new ApiError("NOT_FOUND", "Missing", 404))
          : Promise.resolve({ data: assets.get(id) }),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.rows?.map(({ id, symbol }) => ({ id, symbol }))).toEqual([
      { id: "al2", symbol: "MSFT" },
      { id: "al1", symbol: null },
    ]);
  });

  it("is an error when the alerts fail to load", async () => {
    const { result } = render({
      alerts: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Down", 500)),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.rows).toBeUndefined();
    expect(result.current.isPending).toBe(false);
  });
});
