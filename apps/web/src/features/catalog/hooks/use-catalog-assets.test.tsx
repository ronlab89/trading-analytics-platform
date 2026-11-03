import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useCatalogAssets } from "./use-catalog-assets";

const asset = (id: string) => ({
  id,
  symbol: id.toUpperCase(),
  name: `Asset ${id}`,
  assetType: "STOCK",
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
});

const meta = { page: 1, pageSize: 10, total: 24, totalPages: 3 };

function clientAnswering(
  answer: (input?: CallInput) => Promise<unknown> = () =>
    Promise.resolve({ data: [asset("a1"), asset("a2")], meta }),
) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (_operation, input) => answer(input),
  );
  return { client: { call } as TradingClient, call };
}

describe("useCatalogAssets", () => {
  it("returns the page of active assets with the paging the server counted", async () => {
    const { client, call } = clientAnswering();
    const { result } = renderHook(() => useCatalogAssets({ page: 1, pageSize: 10 }), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.assets.map(({ id }) => id)).toEqual(["a1", "a2"]);
    expect(result.current.data?.meta.total).toBe(24);
    expect(call.mock.calls[0]?.[1]?.query).toEqual({ status: "ACTIVE", page: 1, pageSize: 10 });
  });

  it("asks for the page, the search and the filters it was given", async () => {
    const { client, call } = clientAnswering();
    const { result } = renderHook(
      () =>
        useCatalogAssets(
          { page: 2, pageSize: 20 },
          { assetType: "ETF", exchange: "NASDAQ" },
          " qqq ",
        ),
      { wrapper: tradingClientWrapper(client) },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(call.mock.calls[0]?.[1]?.query).toEqual({
      search: "qqq",
      assetType: "ETF",
      exchange: "NASDAQ",
      status: "ACTIVE",
      page: 2,
      pageSize: 20,
    });
  });

  it("keeps the previous page on screen while the next one loads", async () => {
    let release: () => void = () => undefined;
    const { client } = clientAnswering((input) =>
      input?.query?.page === 2
        ? new Promise((resolve) => {
            release = () => {
              resolve({ data: [asset("a3")], meta: { ...meta, page: 2 } });
            };
          })
        : Promise.resolve({ data: [asset("a1")], meta }),
    );
    const { result, rerender } = renderHook(
      ({ page }) => useCatalogAssets({ page, pageSize: 10 }),
      { initialProps: { page: 1 }, wrapper: tradingClientWrapper(client) },
    );
    await waitFor(() => {
      expect(result.current.data?.assets[0]?.id).toBe("a1");
    });

    rerender({ page: 2 });

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.assets[0]?.id).toBe("a1");
    release();
    await waitFor(() => {
      expect(result.current.data?.assets[0]?.id).toBe("a3");
    });
  });

  it("reports the failure when the catalog cannot load", async () => {
    const { client } = clientAnswering(() =>
      Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
    );
    const { result } = renderHook(() => useCatalogAssets({ page: 1, pageSize: 10 }), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
