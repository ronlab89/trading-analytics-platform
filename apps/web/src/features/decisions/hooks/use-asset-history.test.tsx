import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useAssetHistory } from "./use-asset-history";

function clientAnswering(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  return { client: { call } as TradingClient, call };
}

const range = { from: "2026-08-12", to: "2026-10-06" };

describe("useAssetHistory", () => {
  it("gets the daily candles of the asset in the range through getAssetHistory", async () => {
    const candles = [{ assetId: "a1" }];
    const { client, call } = clientAnswering(() => Promise.resolve({ data: candles }));
    const { result } = renderHook(() => useAssetHistory("a1", range), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(candles);
    expect(call.mock.calls[0]?.[0].operationId).toBe("getAssetHistory");
    expect(call.mock.calls[0]?.[1]).toEqual({
      params: { assetId: "a1" },
      query: { ...range, interval: "1d" },
    });
  });

  it("reports a failure", async () => {
    const { client } = clientAnswering(() =>
      Promise.reject(new ApiError("NOT_FOUND", "No such asset")),
    );
    const { result } = renderHook(() => useAssetHistory("a1", range), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
