import { act, renderHook, waitFor } from "@testing-library/react";
import type { PortfolioResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { usePortfolios } from "@/hooks/use-portfolios";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useArchivePortfolio } from "./use-archive-portfolio";
import { usePortfolio } from "./use-portfolio";

const archived: PortfolioResponse = {
  id: "p1",
  userId: "u1",
  name: "Growth",
  description: null,
  baseCurrency: "USD",
  status: "ARCHIVED",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

function clientWith(archive: () => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      switch (operation.operationId) {
        case "archivePortfolio":
          return archive();
        case "getPortfolio":
          return Promise.resolve({ data: archived });
        default:
          return Promise.resolve({ data: [] });
      }
    },
  );
  const callsOf = (operationId: string) =>
    call.mock.calls.filter(([op]) => op.operationId === operationId);
  return { client: { call } as TradingClient, callsOf };
}

const archiveOk = () => Promise.resolve({ data: archived, meta: { alreadyArchived: false } });

function render(client: TradingClient) {
  return renderHook(
    () => ({
      archive: useArchivePortfolio(),
      list: usePortfolios(),
      detail: usePortfolio("p1"),
    }),
    { wrapper: tradingClientWrapper(client) },
  );
}

describe("useArchivePortfolio", () => {
  it("archives the portfolio it is given and returns it", async () => {
    const { client, callsOf } = clientWith(archiveOk);
    const { result } = render(client);

    let portfolio: PortfolioResponse | undefined;
    await act(async () => {
      portfolio = await result.current.archive.mutateAsync("p1");
    });

    expect(callsOf("archivePortfolio")[0]?.[1]).toEqual({ params: { portfolioId: "p1" } });
    expect(portfolio).toEqual(archived);
  });

  it("sends no Idempotency-Key, because the API does not take it on this endpoint", async () => {
    const { client, callsOf } = clientWith(archiveOk);
    const { result } = render(client);

    await act(async () => {
      await result.current.archive.mutateAsync("p1");
    });

    expect(callsOf("archivePortfolio")[0]?.[1]).not.toHaveProperty("idempotencyKey");
  });

  it("loads the list and the portfolio again once it is archived", async () => {
    const { client, callsOf } = clientWith(archiveOk);
    const { result } = render(client);
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
      expect(result.current.detail.isSuccess).toBe(true);
    });
    expect(callsOf("listPortfolios")).toHaveLength(1);
    expect(callsOf("getPortfolio")).toHaveLength(1);

    await act(async () => {
      await result.current.archive.mutateAsync("p1");
    });

    await waitFor(() => {
      expect(callsOf("listPortfolios")).toHaveLength(2);
      expect(callsOf("getPortfolio")).toHaveLength(2);
    });
  });

  it("treats an already archived portfolio as archived, since the API answers 200", async () => {
    const { client } = clientWith(() =>
      Promise.resolve({ data: archived, meta: { alreadyArchived: true } }),
    );
    const { result } = render(client);

    await act(async () => {
      await result.current.archive.mutateAsync("p1");
    });

    await waitFor(() => {
      expect(result.current.archive.isSuccess).toBe(true);
    });
  });

  it("exposes the API error and leaves the caches alone when archiving fails", async () => {
    const { client, callsOf } = clientWith(() =>
      Promise.reject(new ApiError("NOT_FOUND", "Portfolio not found.", 404)),
    );
    const { result } = render(client);
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
      expect(result.current.detail.isSuccess).toBe(true);
    });

    await act(async () => {
      await result.current.archive.mutateAsync("p1").catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.archive.error).toBeInstanceOf(ApiError);
    });
    expect(callsOf("listPortfolios")).toHaveLength(1);
    expect(callsOf("getPortfolio")).toHaveLength(1);
  });
});
