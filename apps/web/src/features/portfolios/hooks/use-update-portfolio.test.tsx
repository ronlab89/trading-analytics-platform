import { act, renderHook, waitFor } from "@testing-library/react";
import type { PortfolioResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { usePortfolios } from "@/hooks/use-portfolios";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { usePortfolio } from "./use-portfolio";
import { useUpdatePortfolio } from "./use-update-portfolio";

const updated: PortfolioResponse = {
  id: "p1",
  userId: "u1",
  name: "Growth",
  description: "Medium term",
  baseCurrency: "USD",
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

function clientWith(update: () => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      switch (operation.operationId) {
        case "updatePortfolio":
          return update();
        case "getPortfolio":
          return Promise.resolve({ data: updated });
        default:
          return Promise.resolve({ data: [] });
      }
    },
  );
  const callsOf = (operationId: string) =>
    call.mock.calls.filter(([op]) => op.operationId === operationId);
  return { client: { call } as TradingClient, callsOf };
}

function render(client: TradingClient) {
  return renderHook(
    () => ({
      update: useUpdatePortfolio(),
      list: usePortfolios(),
      detail: usePortfolio("p1"),
    }),
    { wrapper: tradingClientWrapper(client) },
  );
}

describe("useUpdatePortfolio", () => {
  it("patches the portfolio it is given with the body it is given", async () => {
    const { client, callsOf } = clientWith(() => Promise.resolve({ data: updated }));
    const { result } = render(client);
    const body = { name: "Growth", description: "Medium term" };

    let portfolio: PortfolioResponse | undefined;
    await act(async () => {
      portfolio = await result.current.update.mutateAsync({ portfolioId: "p1", body });
    });

    expect(callsOf("updatePortfolio")[0]?.[1]).toEqual({ params: { portfolioId: "p1" }, body });
    expect(portfolio).toEqual(updated);
  });

  it("sends no Idempotency-Key, because the API does not take it on this endpoint", async () => {
    const { client, callsOf } = clientWith(() => Promise.resolve({ data: updated }));
    const { result } = render(client);

    await act(async () => {
      await result.current.update.mutateAsync({ portfolioId: "p1", body: { name: "Growth" } });
    });

    expect(callsOf("updatePortfolio")[0]?.[1]).not.toHaveProperty("idempotencyKey");
  });

  it("loads the list and the portfolio again once it changed, so both show the new text", async () => {
    const { client, callsOf } = clientWith(() => Promise.resolve({ data: updated }));
    const { result } = render(client);
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
      expect(result.current.detail.isSuccess).toBe(true);
    });
    expect(callsOf("listPortfolios")).toHaveLength(1);
    expect(callsOf("getPortfolio")).toHaveLength(1);

    await act(async () => {
      await result.current.update.mutateAsync({ portfolioId: "p1", body: { name: "Growth" } });
    });

    await waitFor(() => {
      expect(callsOf("listPortfolios")).toHaveLength(2);
      expect(callsOf("getPortfolio")).toHaveLength(2);
    });
  });

  it("exposes the API error and leaves the caches alone when the change fails", async () => {
    const { client, callsOf } = clientWith(() =>
      Promise.reject(new ApiError("CONFLICT", "An archived portfolio cannot be modified.", 409)),
    );
    const { result } = render(client);
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
      expect(result.current.detail.isSuccess).toBe(true);
    });

    await act(async () => {
      await result.current.update
        .mutateAsync({ portfolioId: "p1", body: { name: "Growth" } })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.update.error).toBeInstanceOf(ApiError);
    });
    expect(callsOf("listPortfolios")).toHaveLength(1);
    expect(callsOf("getPortfolio")).toHaveLength(1);
  });
});
