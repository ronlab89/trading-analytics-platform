import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useScenario } from "./use-scenario";
import { useUpdateScenario } from "./use-update-scenario";

type Answers = Partial<Record<string, (input?: CallInput) => Promise<unknown>>>;

function clientAnswering(answers: Answers) {
  const call = vi.fn((operation: { operationId: string }, input?: CallInput) => {
    const answer = answers[operation.operationId];
    return answer === undefined
      ? Promise.reject(new Error(`unexpected ${operation.operationId}`))
      : answer(input);
  });
  return { client: { call } as unknown as TradingClient, call };
}

const scenario = (name = "Apple falls", status = "DRAFT") => ({
  id: "s1",
  portfolioId: "p1",
  name,
  description: null,
  baseSnapshotId: null,
  status,
  changes: [{ assetId: "a1", percentChange: -10 }],
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-12T10:00:00.000Z",
});

function setup<T>(client: TradingClient, useHook: () => T) {
  const queryClient: QueryClient = createQueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const view = renderHook(useHook, { wrapper: tradingClientWrapper(client, queryClient) });
  return { ...view, queryClient, invalidate };
}

describe("useScenario", () => {
  it("reads one scenario of the portfolio", async () => {
    const { client, call } = clientAnswering({
      getScenario: () => Promise.resolve({ data: scenario() }),
    });
    const { result } = setup(client, () => useScenario("p1", "s1"));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.name).toBe("Apple falls");
    expect(call.mock.calls[0]?.[0].operationId).toBe("getScenario");
    expect(call.mock.calls[0]?.[1]).toEqual({ params: { portfolioId: "p1", scenarioId: "s1" } });
  });

  it("is an error when the scenario cannot be read", async () => {
    const { client } = clientAnswering({ getScenario: () => Promise.reject(new Error("gone")) });
    const { result } = setup(client, () => useScenario("p1", "s1"));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useUpdateScenario", () => {
  it("sends only what changes and keeps the cached scenario as the API answered", async () => {
    const { client, call } = clientAnswering({
      updateScenario: () => Promise.resolve({ data: scenario("Apple falls", "SAVED") }),
    });
    const { result, queryClient } = setup(client, () => useUpdateScenario("p1", "s1"));

    result.current.mutate({ status: "SAVED" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(call.mock.calls[0]?.[0].operationId).toBe("updateScenario");
    expect(call.mock.calls[0]?.[1]).toEqual({
      params: { portfolioId: "p1", scenarioId: "s1" },
      body: { status: "SAVED" },
    });
    expect(queryClient.getQueryData(["scenarios", "p1", "detail", "s1"])).toEqual(
      scenario("Apple falls", "SAVED"),
    );
  });

  it("refreshes the list, and not the calculation, when the changes are the same", async () => {
    const { client } = clientAnswering({
      updateScenario: () => Promise.resolve({ data: scenario("New name") }),
    });
    const { result, invalidate } = setup(client, () => useUpdateScenario("p1", "s1"));

    result.current.mutate({ name: "New name" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["scenarios", "p1"], exact: true });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: ["scenarios", "p1", "impact", "s1"],
    });
  });

  it("asks for the calculation again when the changes are replaced", async () => {
    const { client } = clientAnswering({
      updateScenario: () => Promise.resolve({ data: scenario() }),
    });
    const { result, invalidate } = setup(client, () => useUpdateScenario("p1", "s1"));

    result.current.mutate({ changes: [{ assetId: "a1", percentChange: -10 }] });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["scenarios", "p1", "impact", "s1"] });
  });

  it("leaves the cache as it is when the API refuses", async () => {
    const { client } = clientAnswering({
      updateScenario: () => Promise.reject(new Error("no")),
    });
    const { result, invalidate, queryClient } = setup(client, () => useUpdateScenario("p1", "s1"));

    result.current.mutate({ changes: [] });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(invalidate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["scenarios", "p1", "detail", "s1"])).toBeUndefined();
  });
});
