import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { useSessionStore } from "@/stores/session-store";
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

afterEach(() => {
  useSessionStore.getState().signOut();
  sessionStorage.clear();
});

const trackedJob = (id: string, fileName: string) => ({
  id,
  portfolioId: "p1",
  fileName,
  startedAt: "2026-11-04T11:00:00.000Z",
});

const readJob = (patch: Record<string, unknown>) => ({
  id: "j1",
  portfolioId: "p1",
  status: "PROCESSING",
  stage: "VALIDATING",
  failureReason: null,
  progress: { processed: 1200, total: 5000 },
  ...patch,
});

/** Signs in as a user whose device started the given jobs. */
function startedOnThisDevice(userId: string, jobs: ReturnType<typeof trackedJob>[]) {
  sessionStorage.setItem(`trading:jobs:${userId}`, JSON.stringify(jobs));
  useSessionStore.getState().signIn({
    user: { id: userId, email: `${userId}@example.com`, displayName: userId, role: "TRADER" },
    session: { accessToken: "token", expiresAt: "2099-01-01T00:00:00.000Z" },
  });
}

describe("useActivityEvents processes", () => {
  it("lists an import that is running with its stage and count, between the other events", async () => {
    startedOnThisDevice("act-running", [trackedJob("j1", "orders.csv")]);
    const { result } = render({
      ...healthy,
      getJob: () => Promise.resolve({ data: readJob({}) }),
    });

    await waitFor(() => {
      expect(result.current.events?.map(({ id }) => id)).toEqual([
        "notification:n1",
        "process:j1",
        "transaction:t1",
      ]);
    });
    expect(result.current.events?.[1]).toMatchObject({
      source: "PROCESS",
      severity: "INFO",
      title: "Importing orders.csv",
      message: "Validating · 1,200 of 5,000",
      jobId: "j1",
      progress: { processed: 1200, total: 5000 },
    });
  });

  it("says how many transactions a completed import added", async () => {
    startedOnThisDevice("act-completed", [trackedJob("j1", "orders.csv")]);
    const { result } = render({
      ...healthy,
      getJob: () =>
        Promise.resolve({
          data: readJob({
            status: "COMPLETED",
            stage: "APPLYING",
            progress: { processed: 8, total: 8 },
          }),
        }),
    });

    await waitFor(() => {
      expect(result.current.events?.some(({ id }) => id === "process:j1")).toBe(true);
    });
    expect(result.current.events?.find(({ id }) => id === "process:j1")).toMatchObject({
      severity: "SUCCESS",
      title: "Import completed",
      message: "orders.csv · 8 transactions were added to the portfolio.",
    });
  });

  it("gives the reason of a failed import", async () => {
    startedOnThisDevice("act-failed", [trackedJob("j1", "orders.csv")]);
    const { result } = render({
      ...healthy,
      getJob: () =>
        Promise.resolve({
          data: readJob({ status: "FAILED", failureReason: "VALIDATION_FAILED" }),
        }),
    });

    await waitFor(() => {
      expect(result.current.events?.some(({ id }) => id === "process:j1")).toBe(true);
    });
    expect(result.current.events?.find(({ id }) => id === "process:j1")).toMatchObject({
      severity: "ERROR",
      title: "Import failed",
      message: "orders.csv · The file has rows that cannot be imported.",
    });
  });

  it("does not hold the list back while a job has not answered", async () => {
    startedOnThisDevice("act-slow", [trackedJob("j1", "orders.csv")]);
    const { result } = render({ ...healthy, getJob: () => new Promise(() => undefined) });

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });
    expect(result.current.isPending).toBe(false);
  });
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
