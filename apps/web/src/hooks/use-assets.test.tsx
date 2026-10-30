import { renderHook, waitFor } from "@testing-library/react";
import type { AssetResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useAssets } from "./use-assets";

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

const apple = asset("a1", "AAPL", "Apple Inc.");
const microsoft = asset("a2", "MSFT", "Microsoft");

function clientAnswering(answer: (input?: CallInput) => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (_operation, input) => answer(input),
  );
  return { client: { call } as TradingClient, call };
}

describe("useAssets", () => {
  it("gets each asset through the getAsset operation and indexes them by id", async () => {
    const byId = new Map([
      ["a1", apple],
      ["a2", microsoft],
    ]);
    const { client, call } = clientAnswering((input) =>
      Promise.resolve({ data: byId.get(input?.params?.assetId ?? "") }),
    );
    const { result } = renderHook(() => useAssets(["a1", "a2"]), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.assets.get("a1")).toEqual(apple);
    expect(result.current.assets.get("a2")).toEqual(microsoft);
    expect(call.mock.calls.map(([operation]) => operation.operationId)).toEqual([
      "getAsset",
      "getAsset",
    ]);
    expect(call.mock.calls.map(([, input]) => input)).toEqual(
      expect.arrayContaining([{ params: { assetId: "a1" } }, { params: { assetId: "a2" } }]),
    );
  });

  it("asks once for an asset that appears in several positions", async () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: apple }));
    const { result } = renderHook(() => useAssets(["a1", "a1", "a1"]), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("does not call the API when there are no ids", () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: apple }));
    const { result } = renderHook(() => useAssets([]), { wrapper: tradingClientWrapper(client) });

    expect(result.current.isPending).toBe(false);
    expect(result.current.assets.size).toBe(0);
    expect(call).not.toHaveBeenCalled();
  });

  it("keeps the assets it could load and flags the failure of the others", async () => {
    const { client } = clientAnswering((input) =>
      input?.params?.assetId === "a1"
        ? Promise.resolve({ data: apple })
        : Promise.reject(new ApiError("NOT_FOUND", "Asset not found", 404)),
    );
    const { result } = renderHook(() => useAssets(["a1", "a2"]), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.isError).toBe(true);
    expect(result.current.assets.get("a1")).toEqual(apple);
    expect(result.current.assets.has("a2")).toBe(false);
  });
});
