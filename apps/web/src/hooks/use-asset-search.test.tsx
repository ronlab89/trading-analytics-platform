import { renderHook, waitFor } from "@testing-library/react";
import type { AssetResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useAssetSearch } from "./use-asset-search";

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

function clientWith(answer: (input?: CallInput) => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (_operation, input) => answer(input),
  );
  return { client: { call } as TradingClient, call };
}

const queryOf = (call: ReturnType<typeof clientWith>["call"], index = 0) =>
  call.mock.calls[index]?.[1]?.query;

function render(client: TradingClient, term: string, options?: { enabled?: boolean }) {
  return renderHook(({ value }) => useAssetSearch(value, options), {
    initialProps: { value: term },
    wrapper: tradingClientWrapper(client),
  });
}

describe("useAssetSearch", () => {
  it("asks for the active assets that match the term", async () => {
    const { client, call } = clientWith(() => Promise.resolve({ data: [apple] }));
    const { result } = render(client, "app");

    await waitFor(() => {
      expect(result.current.data).toEqual([apple]);
    });
    expect(call.mock.calls[0]?.[0]).toMatchObject({ operationId: "listAssets" });
    expect(queryOf(call)).toEqual({ search: "app", status: "ACTIVE", pageSize: 20 });
  });

  it("trims the term", async () => {
    const { client, call } = clientWith(() => Promise.resolve({ data: [apple] }));
    const { result } = render(client, "  app  ");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryOf(call)?.search).toBe("app");
  });

  it("lists the first assets, with no search, while the term is empty", async () => {
    const { client, call } = clientWith(() => Promise.resolve({ data: [apple, microsoft] }));
    const { result } = render(client, "   ");

    await waitFor(() => {
      expect(result.current.data).toEqual([apple, microsoft]);
    });
    expect(queryOf(call)?.search).toBeUndefined();
  });

  it("cuts a term longer than the API accepts instead of asking for a 400", async () => {
    const { client, call } = clientWith(() => Promise.resolve({ data: [] }));
    const { result } = render(client, "a".repeat(150));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(String(queryOf(call)?.search)).toHaveLength(100);
  });

  it("keeps the previous results while the next term loads", async () => {
    let release: (value: unknown) => void = () => undefined;
    const answers = [
      Promise.resolve({ data: [apple] }),
      new Promise((resolve) => {
        release = resolve;
      }),
    ];
    const { client } = clientWith(() => answers.shift() ?? Promise.resolve({ data: [] }));
    const { result, rerender } = render(client, "a");
    await waitFor(() => {
      expect(result.current.data).toEqual([apple]);
    });

    rerender({ value: "ms" });

    expect(result.current.data).toEqual([apple]);
    expect(result.current.isPlaceholderData).toBe(true);
    release({ data: [microsoft] });
    await waitFor(() => {
      expect(result.current.data).toEqual([microsoft]);
    });
  });

  it("does not ask while it is disabled", () => {
    const { client, call } = clientWith(() => Promise.resolve({ data: [] }));
    render(client, "app", { enabled: false });

    expect(call).not.toHaveBeenCalled();
  });

  it("reports a failure", async () => {
    const { client } = clientWith(() => Promise.reject(new ApiError("INTERNAL_ERROR", "x", 500)));
    const { result } = render(client, "app");

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
