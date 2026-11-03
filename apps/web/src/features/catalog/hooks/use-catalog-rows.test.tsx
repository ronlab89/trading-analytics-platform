import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useCatalogRows } from "./use-catalog-rows";

const asset = (id: string, symbol: string, name: string, assetType = "STOCK") => ({
  id,
  symbol,
  name,
  assetType,
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
});

const price = (assetId: string, amount: string, changePercent: number) => ({
  assetId,
  price: { amount, currency: "USD" },
  previousPrice: { amount, currency: "USD" },
  change: { amount: "0.00", currency: "USD" },
  changePercent,
  timestamp: "2026-11-03T14:32:07.000Z",
  source: "SIMULATED",
});

const watchItem = (assetId: string) => ({
  id: `w-${assetId}`,
  userId: "u1",
  assetId,
  createdAt: "2026-11-01T10:00:00.000Z",
});

const meta = (page = 1) => ({ page, pageSize: 10, total: 24, totalPages: 3 });

interface Answers {
  list?: (input?: CallInput) => Promise<unknown>;
  watchlist?: () => Promise<unknown>;
  prices?: (input?: CallInput) => Promise<unknown>;
}

function render(answers: Answers = {}, page = 1) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      switch (operation.operationId) {
        case "listAssets":
          return (
            answers.list?.(input) ??
            Promise.resolve({
              data: [
                asset("a1", "AAPL", "Apple Inc."),
                asset("a2", "QQQ", "Invesco QQQ Trust", "ETF"),
              ],
              meta: meta(),
            })
          );
        case "listWatchlist":
          return answers.watchlist?.() ?? Promise.resolve({ data: [watchItem("a2")] });
        default:
          return (
            answers.prices?.(input) ??
            Promise.resolve({ data: [price("a1", "180.70", 2.1), price("a2", "480.15", 0.6)] })
          );
      }
    },
  );
  const view = renderHook(({ page: current }) => useCatalogRows({ page: current, pageSize: 10 }), {
    initialProps: { page },
    wrapper: tradingClientWrapper({ call }),
  });
  return { ...view, call };
}

describe("useCatalogRows", () => {
  it("joins each asset with its price and whether the user watches it", async () => {
    const { result } = render();

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.rows).toEqual([
      {
        assetId: "a1",
        symbol: "AAPL",
        name: "Apple Inc.",
        assetType: "STOCK",
        exchange: "NASDAQ",
        price: { amount: "180.70", currency: "USD" },
        changePercent: 2.1,
        watched: false,
      },
      {
        assetId: "a2",
        symbol: "QQQ",
        name: "Invesco QQQ Trust",
        assetType: "ETF",
        exchange: "NASDAQ",
        price: { amount: "480.15", currency: "USD" },
        changePercent: 0.6,
        watched: true,
      },
    ]);
    expect(result.current.meta?.total).toBe(24);
    expect(result.current.canToggle).toBe(true);
  });

  it("has no rows until the prices and the watchlist are in", () => {
    const { result } = render({ prices: () => new Promise(() => undefined) });

    expect(result.current.isPending).toBe(true);
    expect(result.current.rows).toBeUndefined();
  });

  it("keeps the row with a null price when the prices fail", async () => {
    const { result } = render({
      prices: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.rows?.[0]).toMatchObject({
      symbol: "AAPL",
      price: null,
      changePercent: null,
    });
  });

  it("keeps the catalog without stars when the watchlist cannot load", async () => {
    const { result } = render({
      watchlist: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.canToggle).toBe(false);
    expect(result.current.rows).toHaveLength(2);
  });

  it("asks for no prices when the page has no assets", async () => {
    const { result, call } = render({ list: () => Promise.resolve({ data: [], meta: meta() }) });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.rows).toEqual([]);
    expect(call.mock.calls.map(([operation]) => operation.operationId)).not.toContain(
      "getMarketPrices",
    );
  });

  it("keeps the rows on screen while the next page loads", async () => {
    let release: () => void = () => undefined;
    const { result, rerender } = render({
      list: (input) =>
        input?.query?.page === 2
          ? new Promise((resolve) => {
              release = () => {
                resolve({ data: [asset("a3", "TSLA", "Tesla")], meta: meta(2) });
              };
            })
          : Promise.resolve({ data: [asset("a1", "AAPL", "Apple Inc.")], meta: meta() }),
      prices: () =>
        Promise.resolve({ data: [price("a1", "180.70", 2.1), price("a3", "242.10", -2.2)] }),
    });
    await waitFor(() => {
      expect(result.current.rows?.[0]?.symbol).toBe("AAPL");
    });

    rerender({ page: 2 });

    expect(result.current.isPending).toBe(false);
    expect(result.current.rows?.[0]?.symbol).toBe("AAPL");
    release();
    await waitFor(() => {
      expect(result.current.rows?.[0]?.symbol).toBe("TSLA");
    });
    expect(result.current.rows?.[0]?.price?.amount).toBe("242.10");
  });

  it("is an error when the catalog cannot load", async () => {
    const { result } = render({
      list: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.rows).toBeUndefined();
    expect(result.current.isPending).toBe(false);
  });
});
