import { renderHook, waitFor } from "@testing-library/react";
import type { AssetResponse, TransactionResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useTransactionRows } from "./use-transaction-rows";

function transaction(
  id: string,
  assetId: string,
  type: "BUY" | "SELL" = "BUY",
): TransactionResponse {
  return {
    id,
    portfolioId: "p1",
    assetId,
    type,
    quantity: 10,
    price: { amount: "180.20", currency: "USD" },
    fees: { amount: "1.00", currency: "USD" },
    realizedPnL: null,
    status: "COMPLETED",
    executedAt: "2026-10-06T14:29:00.000Z",
    createdAt: "2026-10-06T14:29:00.000Z",
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

const meta = { page: 1, pageSize: 10, total: 48, totalPages: 5 };

interface Answers {
  list?: (input?: CallInput) => Promise<unknown>;
  asset?: (assetId: string) => Promise<unknown>;
}

function clientWith({ list, asset: assetAnswer }: Answers) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      if (operation.operationId === "listTransactions") {
        return (
          list?.(input) ??
          Promise.resolve({
            data: [transaction("t1", "a1"), transaction("t2", "a2", "SELL")],
            meta,
          })
        );
      }
      const assetId = input?.params?.assetId ?? "";
      return assetAnswer ? assetAnswer(assetId) : Promise.resolve({ data: assets.get(assetId) });
    },
  );
  return { client: { call } as TradingClient, call };
}

function renderRows(answers: Answers = {}, page = 1) {
  const { client, call } = clientWith(answers);
  const hook = renderHook(
    ({ current }) => useTransactionRows("p1", { page: current, pageSize: 10 }),
    { initialProps: { current: page }, wrapper: tradingClientWrapper(client) },
  );
  return { ...hook, call };
}

describe("useTransactionRows", () => {
  it("joins each transaction with its asset and derives the total from quantity and price", async () => {
    const { result } = renderRows();

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.rows).toEqual([
      {
        id: "t1",
        executedAt: "2026-10-06T14:29:00.000Z",
        type: "BUY",
        symbol: "AAPL",
        name: "Apple Inc.",
        quantity: 10,
        price: { amount: "180.20", currency: "USD" },
        fees: { amount: "1.00", currency: "USD" },
        total: { amount: "1802.00", currency: "USD" },
        status: "COMPLETED",
      },
      expect.objectContaining({ id: "t2", type: "SELL", symbol: "MSFT", name: "Microsoft" }),
    ]);
  });

  it("exposes the server's paging data", async () => {
    const { result } = renderRows();

    await waitFor(() => {
      expect(result.current.meta).toEqual(meta);
    });
  });

  it("asks the server for the page and size it was given", async () => {
    const { result, call } = renderRows({}, 3);

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: "listTransactions" }),
      { params: { portfolioId: "p1" }, query: { page: 3, pageSize: 10 } },
    );
  });

  it("keeps the previous page's rows and meta while the next page loads", async () => {
    let release: (value: unknown) => void = () => undefined;
    const { result, rerender } = renderRows({
      list: (input) =>
        input?.query?.page === 2
          ? new Promise((resolve) => {
              release = resolve;
            })
          : Promise.resolve({ data: [transaction("t1", "a1")], meta }),
    });
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    rerender({ current: 2 });

    expect(result.current.rows).toHaveLength(1);
    expect(result.current.meta).toEqual(meta);
    release({ data: [transaction("t9", "a1")], meta: { ...meta, page: 2 } });
    await waitFor(() => {
      expect(result.current.rows?.[0]?.id).toBe("t9");
    });
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
    expect(result.current.rows?.[1]).toMatchObject({ id: "t2", symbol: null, name: null });
  });

  it("is an empty page, without asking for any asset, when there are no transactions", async () => {
    const { result, call } = renderRows({
      list: () => Promise.resolve({ data: [], meta: { ...meta, total: 0, totalPages: 0 } }),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.rows).toEqual([]);
    expect(
      call.mock.calls.filter(([operation]) => operation.operationId === "getAsset"),
    ).toHaveLength(0);
  });

  it("reports a failed request and retries it on demand", async () => {
    let fail = true;
    const { result } = renderRows({
      list: () =>
        fail
          ? Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503))
          : Promise.resolve({ data: [transaction("t1", "a1")], meta }),
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
});
