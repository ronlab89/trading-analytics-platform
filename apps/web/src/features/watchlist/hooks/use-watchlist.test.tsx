import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useRemoveFromWatchlist } from "./use-remove-from-watchlist";
import { useWatchlist } from "./use-watchlist";

const item = (assetId: string) => ({
  id: `w-${assetId}`,
  userId: "u1",
  assetId,
  createdAt: "2026-11-01T10:00:00.000Z",
});

function clientWith(remove: (input?: CallInput) => Promise<unknown>, items = [item("a1")]) {
  let current = items;
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      if (operation.operationId === "removeFromWatchlist") {
        return remove(input).then((result) => {
          current = current.filter((entry) => entry.assetId !== input?.params?.assetId);
          return result;
        });
      }
      return Promise.resolve({ data: current });
    },
  );
  const callsOf = (operationId: string) =>
    call.mock.calls.filter(([operation]) => operation.operationId === operationId);
  return { client: { call } as TradingClient, callsOf };
}

describe("useWatchlist", () => {
  it("returns the assets the user watches", async () => {
    const { client } = clientWith(() => Promise.resolve(undefined), [item("a1"), item("a2")]);
    const { result } = renderHook(() => useWatchlist(), { wrapper: tradingClientWrapper(client) });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.map((entry) => entry.assetId)).toEqual(["a1", "a2"]);
  });

  it("reports the failure when the list cannot load", async () => {
    const client = {
      call: vi.fn(() => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error"))),
    } as unknown as TradingClient;
    const { result } = renderHook(() => useWatchlist(), { wrapper: tradingClientWrapper(client) });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useRemoveFromWatchlist", () => {
  it("removes the asset by id and refreshes the list", async () => {
    const { client, callsOf } = clientWith(() => Promise.resolve(undefined));
    const { result } = renderHook(
      () => ({ list: useWatchlist(), remove: useRemoveFromWatchlist() }),
      { wrapper: tradingClientWrapper(client) },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });

    await act(() => result.current.remove.mutateAsync("a1"));

    const [, input] = callsOf("removeFromWatchlist")[0] ?? [];
    expect(input?.params).toEqual({ assetId: "a1" });
    await waitFor(() => {
      expect(result.current.list.data).toEqual([]);
    });
  });

  it("keeps the list and reports the failure when the removal is refused", async () => {
    const { client } = clientWith(() =>
      Promise.reject(new ApiError("NOT_FOUND", "Not on the watchlist")),
    );
    const { result } = renderHook(
      () => ({ list: useWatchlist(), remove: useRemoveFromWatchlist() }),
      { wrapper: tradingClientWrapper(client) },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });

    await act(() => result.current.remove.mutateAsync("a1").catch(() => undefined));

    await waitFor(() => {
      expect(result.current.remove.isError).toBe(true);
    });
    expect(result.current.list.data).toHaveLength(1);
  });
});
