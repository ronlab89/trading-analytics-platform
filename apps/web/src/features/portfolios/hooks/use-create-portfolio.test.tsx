import { act, renderHook, waitFor } from "@testing-library/react";
import type { PortfolioResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { usePortfolios } from "@/hooks/use-portfolios";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useCreatePortfolio } from "./use-create-portfolio";

const created: PortfolioResponse = {
  id: "p9",
  userId: "u1",
  name: "Long term",
  description: null,
  baseCurrency: "USD",
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function clientWith(create: () => Promise<unknown>) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) =>
      operation.operationId === "createPortfolio" ? create() : Promise.resolve({ data: [] }),
  );
  const listCalls = () => call.mock.calls.filter(([op]) => op.operationId === "listPortfolios");
  return { client: { call } as TradingClient, call, listCalls };
}

function render(client: TradingClient) {
  return renderHook(() => ({ create: useCreatePortfolio(), list: usePortfolios() }), {
    wrapper: tradingClientWrapper(client),
  });
}

describe("useCreatePortfolio", () => {
  it("creates the portfolio through the createPortfolio operation with the body it is given", async () => {
    const { client, call } = clientWith(() => Promise.resolve({ data: created }));
    const { result } = render(client);
    const body = { name: "Long term", baseCurrency: "USD" };

    let portfolio: PortfolioResponse | undefined;
    await act(async () => {
      portfolio = await result.current.create.mutateAsync(body);
    });

    const createCall = call.mock.calls.find(([op]) => op.operationId === "createPortfolio");
    expect(createCall?.[1]).toEqual({ body });
    expect(portfolio).toEqual(created);
  });

  it("sends no Idempotency-Key, because the API does not take it on this endpoint", async () => {
    const { client, call } = clientWith(() => Promise.resolve({ data: created }));
    const { result } = render(client);

    await act(async () => {
      await result.current.create.mutateAsync({ name: "Long term", baseCurrency: "USD" });
    });

    const createCall = call.mock.calls.find(([op]) => op.operationId === "createPortfolio");
    expect(createCall?.[1]).not.toHaveProperty("idempotencyKey");
  });

  it("loads the list again once the portfolio exists, so it shows up", async () => {
    const { client, listCalls } = clientWith(() => Promise.resolve({ data: created }));
    const { result } = render(client);
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });
    expect(listCalls()).toHaveLength(1);

    await act(async () => {
      await result.current.create.mutateAsync({ name: "Long term", baseCurrency: "USD" });
    });

    await waitFor(() => {
      expect(listCalls()).toHaveLength(2);
    });
  });

  it("exposes the API error and leaves the list alone when the creation fails", async () => {
    const { client, listCalls } = clientWith(() =>
      Promise.reject(new ApiError("VALIDATION_ERROR", "Portfolio name is required.", 400)),
    );
    const { result } = render(client);
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });

    await act(async () => {
      await result.current.create
        .mutateAsync({ name: "Long term", baseCurrency: "USD" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.create.error).toBeInstanceOf(ApiError);
    });
    expect(listCalls()).toHaveLength(1);
  });
});
