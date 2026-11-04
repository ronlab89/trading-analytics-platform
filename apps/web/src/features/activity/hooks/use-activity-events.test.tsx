import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import "@/i18n";
import { useActivityEvents } from "./use-activity-events";

const portfolio = { id: "p1", name: "Main", status: "ACTIVE", baseCurrency: "USD" };

const notification = {
  id: "n1",
  userId: "u1",
  type: "ALERT",
  title: "Risk threshold exceeded",
  message: "Volatility is above the limit",
  severity: "WARNING",
  readAt: null,
  createdAt: "2026-11-04T12:00:00.000Z",
  metadata: {},
};

const transaction = {
  id: "t1",
  portfolioId: "p1",
  assetId: "a1",
  type: "BUY",
  quantity: 15,
  price: { amount: "129.30", currency: "USD" },
  fees: { amount: "1.00", currency: "USD" },
  realizedPnL: null,
  status: "COMPLETED",
  executedAt: "2026-11-04T10:00:00.000Z",
  createdAt: "2026-11-04T10:00:00.000Z",
};

type Answers = Partial<Record<string, () => Promise<unknown>>>;

function clientAnswering(answers: Answers) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      const answer = answers[operation.operationId];
      return answer ? answer() : Promise.reject(new Error(`Unexpected ${operation.operationId}`));
    },
  );
  return { client: { call } as TradingClient, call };
}

const healthy: Answers = {
  listPortfolios: () => Promise.resolve({ data: [portfolio] }),
  listNotifications: () => Promise.resolve({ data: [notification] }),
  listTransactions: () =>
    Promise.resolve({ data: [transaction], meta: { page: 1, pageSize: 100, total: 1 } }),
  getAsset: () => Promise.resolve({ data: { id: "a1", symbol: "AAPL", name: "Apple Inc." } }),
};

function render(answers: Answers) {
  const { client, call } = clientAnswering(answers);
  const hook = renderHook(() => useActivityEvents(), { wrapper: tradingClientWrapper(client) });
  return { ...hook, call };
}

beforeEach(() => {
  useActivePortfolioStore.setState({ selectedId: undefined });
});

describe("useActivityEvents", () => {
  it("is pending until the notifications, the transactions and their assets are in", async () => {
    const { result } = render(healthy);

    expect(result.current.isPending).toBe(true);
    expect(result.current.events).toBeUndefined();
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });

  it("merges the alerts and the transactions of the active portfolio, newest first, in words", async () => {
    const { result } = render(healthy);

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });
    const [alert, bought] = result.current.events ?? [];
    expect(alert).toMatchObject({ id: "notification:n1", source: "ALERT", severity: "WARNING" });
    expect(bought).toMatchObject({
      id: "transaction:t1",
      source: "TRANSACTION",
      severity: "SUCCESS",
      title: "Bought AAPL",
      transactionId: "t1",
    });
    expect(bought?.message).toBe("15 at $129.30 · Settled");
  });

  it("gives the row of a transaction, so the activity can open its detail", async () => {
    const { result } = render(healthy);

    await waitFor(() => {
      expect(result.current.transactionRows.get("t1")).toMatchObject({
        id: "t1",
        symbol: "AAPL",
        name: "Apple Inc.",
      });
    });
  });

  it("still lists the transaction when its asset does not load, with an unknown asset", async () => {
    const { result } = render({
      ...healthy,
      getAsset: () => Promise.reject(new ApiError("NOT_FOUND", "Gone", 404)),
    });

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });
    expect(result.current.events?.[1]?.title).toBe("Bought Unknown asset");
  });

  it("lists only the alerts when the user has no portfolio, and asks for no transactions", async () => {
    const { result, call } = render({
      ...healthy,
      listPortfolios: () => Promise.resolve({ data: [] }),
    });

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });
    expect(result.current.events?.[0]?.id).toBe("notification:n1");
    expect(
      call.mock.calls.some(([operation]) => operation.operationId === "listTransactions"),
    ).toBe(false);
  });

  it("fails when the notifications fail, and tries again when asked", async () => {
    let failing = true;
    const { result } = render({
      ...healthy,
      listNotifications: () =>
        failing
          ? Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503))
          : Promise.resolve({ data: [notification] }),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.events).toBeUndefined();

    failing = false;
    result.current.retry();
    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });
    expect(result.current.isError).toBe(false);
  });

  it("fails when the transactions fail, because half of the activity would be a lie", async () => {
    const { result } = render({
      ...healthy,
      listTransactions: () => Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503)),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.events).toBeUndefined();
  });
});
