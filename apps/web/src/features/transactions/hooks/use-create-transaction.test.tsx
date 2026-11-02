import { act, renderHook, waitFor } from "@testing-library/react";
import type { CreateTransactionRequestBody } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { useOverview } from "@/features/dashboard/hooks/use-overview";
import { usePositions } from "@/features/portfolios/hooks/use-positions";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useCreateTransaction } from "./use-create-transaction";
import { useTransactions } from "./use-transactions";

const body: CreateTransactionRequestBody = {
  assetId: "a1",
  type: "BUY",
  quantity: 10,
  price: { amount: "180.20", currency: "USD" },
};

const created = { transaction: { id: "t1" }, position: null };

function clientWith(create: (input?: CallInput) => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      switch (operation.operationId) {
        case "createTransaction":
          return create(input);
        case "listTransactions":
          return Promise.resolve({
            data: [],
            meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
          });
        default:
          return Promise.resolve({ data: [] });
      }
    },
  );
  const callsOf = (operationId: string) =>
    call.mock.calls.filter(([operation]) => operation.operationId === operationId);
  return { client: { call } as TradingClient, callsOf };
}

function render(client: TradingClient) {
  return renderHook(
    () => ({
      create: useCreateTransaction("p1"),
      list: useTransactions("p1", { page: 1, pageSize: 10 }),
      positions: usePositions("p1"),
      overview: useOverview("p1"),
    }),
    { wrapper: tradingClientWrapper(client) },
  );
}

const keyOf = (input: CallInput | undefined) => input?.idempotencyKey;

describe("useCreateTransaction", () => {
  it("sends the request to the portfolio with an Idempotency-Key", async () => {
    const { client, callsOf } = clientWith(() => Promise.resolve({ data: created }));
    const { result } = render(client);

    await act(() => result.current.create.mutateAsync(body));

    const [, input] = callsOf("createTransaction")[0] ?? [];
    expect(input?.params).toEqual({ portfolioId: "p1" });
    expect(input?.body).toEqual(body);
    expect(keyOf(input)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns the transaction and the position it changed", async () => {
    const { client } = clientWith(() => Promise.resolve({ data: created }));
    const { result } = render(client);

    await expect(result.current.create.mutateAsync(body)).resolves.toEqual(created);
  });

  it("keeps the key when the same request is sent again after a failure", async () => {
    const create = vi
      .fn<(input?: CallInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("TIMEOUT", "Timed out"))
      .mockResolvedValue({ data: created });
    const { client, callsOf } = clientWith(create);
    const { result } = render(client);

    await act(() => result.current.create.mutateAsync(body).catch(() => undefined));
    await act(() => result.current.create.mutateAsync(body));

    const [first, second] = callsOf("createTransaction").map(([, input]) => keyOf(input));
    expect(second).toBe(first);
  });

  it("uses a new key when the request changes", async () => {
    const create = vi
      .fn<(input?: CallInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("TIMEOUT", "Timed out"))
      .mockResolvedValue({ data: created });
    const { client, callsOf } = clientWith(create);
    const { result } = render(client);

    await act(() => result.current.create.mutateAsync(body).catch(() => undefined));
    await act(() => result.current.create.mutateAsync({ ...body, quantity: 11 }));

    const [first, second] = callsOf("createTransaction").map(([, input]) => keyOf(input));
    expect(second).not.toBe(first);
  });

  it("uses a new key for the next transaction once one was recorded", async () => {
    const { client, callsOf } = clientWith(() => Promise.resolve({ data: created }));
    const { result } = render(client);

    await act(() => result.current.create.mutateAsync(body));
    await act(() => result.current.create.mutateAsync(body));

    const [first, second] = callsOf("createTransaction").map(([, input]) => keyOf(input));
    expect(second).not.toBe(first);
  });

  it("refreshes the transactions, the positions and the overview of the portfolio", async () => {
    const { client, callsOf } = clientWith(() => Promise.resolve({ data: created }));
    const { result } = render(client);
    await waitFor(() => {
      expect(callsOf("listTransactions")).toHaveLength(1);
      expect(callsOf("listPositions")).toHaveLength(1);
      expect(callsOf("getPortfolioOverview")).toHaveLength(1);
    });

    await act(() => result.current.create.mutateAsync(body));

    await waitFor(() => {
      expect(callsOf("listTransactions")).toHaveLength(2);
      expect(callsOf("listPositions")).toHaveLength(2);
      expect(callsOf("getPortfolioOverview")).toHaveLength(2);
    });
  });

  it("does not refresh anything when the transaction is rejected", async () => {
    const { client, callsOf } = clientWith(() =>
      Promise.reject(new ApiError("VALIDATION_ERROR", "Rejected", 400)),
    );
    const { result } = render(client);
    await waitFor(() => {
      expect(callsOf("listTransactions")).toHaveLength(1);
    });

    await act(() => result.current.create.mutateAsync(body).catch(() => undefined));

    expect(callsOf("listTransactions")).toHaveLength(1);
    expect(callsOf("listPositions")).toHaveLength(1);
    expect(callsOf("getPortfolioOverview")).toHaveLength(1);
  });
});
