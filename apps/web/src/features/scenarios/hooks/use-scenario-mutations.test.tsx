import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useDeleteScenario } from "./use-delete-scenario";
import { useDuplicateScenario } from "./use-duplicate-scenario";

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

function setup<T>(client: TradingClient, useHook: () => T) {
  const queryClient: QueryClient = createQueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const removed = vi.spyOn(queryClient, "removeQueries");
  const view = renderHook(useHook, { wrapper: tradingClientWrapper(client, queryClient) });
  return { ...view, invalidate, removed };
}

const source = (status: string, description: string | null = "A thought.") => ({
  id: "s1",
  portfolioId: "p1",
  name: "Apple falls",
  description,
  baseSnapshotId: null,
  status,
  changes: [{ assetId: "a1", percentChange: -10 }],
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-12T10:00:00.000Z",
});

const copyOf = (status: string) => ({ ...source(status), id: "s2", name: "Apple falls (copy)" });

describe("useDeleteScenario", () => {
  it("deletes the scenario of the portfolio and refreshes the list", async () => {
    const { client, call } = clientAnswering({ deleteScenario: () => Promise.resolve(undefined) });
    const { result, invalidate, removed } = setup(client, () => useDeleteScenario("p1"));

    result.current.mutate("s1");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(call.mock.calls[0]?.[0].operationId).toBe("deleteScenario");
    expect(call.mock.calls[0]?.[1]).toEqual({ params: { portfolioId: "p1", scenarioId: "s1" } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["scenarios", "p1"], exact: true });
    expect(removed).toHaveBeenCalledWith({ queryKey: ["scenarios", "p1", "impact", "s1"] });
  });

  it("keeps the list as it is when the API refuses", async () => {
    const { client } = clientAnswering({ deleteScenario: () => Promise.reject(new Error("no")) });
    const { result, invalidate, removed } = setup(client, () => useDeleteScenario("p1"));

    result.current.mutate("s1");

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(invalidate).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
  });
});

describe("useDuplicateScenario", () => {
  it("copies the name, the description and the changes of a saved scenario, and saves the copy", async () => {
    const { client, call } = clientAnswering({
      getScenario: () => Promise.resolve({ data: source("SAVED") }),
      createScenario: () => Promise.resolve({ data: copyOf("DRAFT") }),
      updateScenario: () => Promise.resolve({ data: copyOf("SAVED") }),
    });
    const { result, invalidate } = setup(client, () => useDuplicateScenario("p1"));

    result.current.mutate({ scenarioId: "s1", name: "Apple falls (copy)" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(call.mock.calls.map(([operation]) => operation.operationId)).toEqual([
      "getScenario",
      "createScenario",
      "updateScenario",
    ]);
    expect(call.mock.calls[0]?.[1]).toEqual({ params: { portfolioId: "p1", scenarioId: "s1" } });
    expect(call.mock.calls[1]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      body: {
        name: "Apple falls (copy)",
        description: "A thought.",
        changes: [{ assetId: "a1", percentChange: -10 }],
      },
    });
    expect(call.mock.calls[2]?.[1]).toEqual({
      params: { portfolioId: "p1", scenarioId: "s2" },
      body: { status: "SAVED" },
    });
    expect(result.current.data?.status).toBe("SAVED");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["scenarios", "p1"], exact: true });
  });

  it("leaves a draft a draft, and sends no description the source does not have", async () => {
    const { client, call } = clientAnswering({
      getScenario: () => Promise.resolve({ data: source("DRAFT", null) }),
      createScenario: () => Promise.resolve({ data: copyOf("DRAFT") }),
    });
    const { result } = setup(client, () => useDuplicateScenario("p1"));

    result.current.mutate({ scenarioId: "s1", name: "Apple falls (copy)" });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(call.mock.calls.map(([operation]) => operation.operationId)).toEqual([
      "getScenario",
      "createScenario",
    ]);
    expect(call.mock.calls[1]?.[1]?.body).toEqual({
      name: "Apple falls (copy)",
      changes: [{ assetId: "a1", percentChange: -10 }],
    });
  });

  it("creates nothing when the source cannot be read", async () => {
    const { client, call } = clientAnswering({
      getScenario: () => Promise.reject(new Error("gone")),
    });
    const { result, invalidate } = setup(client, () => useDuplicateScenario("p1"));

    result.current.mutate({ scenarioId: "s1", name: "Apple falls (copy)" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(call).toHaveBeenCalledOnce();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("is an error when the copy cannot be saved, but still shows the draft that was created", async () => {
    const { client } = clientAnswering({
      getScenario: () => Promise.resolve({ data: source("SAVED") }),
      createScenario: () => Promise.resolve({ data: copyOf("DRAFT") }),
      updateScenario: () => Promise.reject(new Error("no")),
    });
    const { result, invalidate } = setup(client, () => useDuplicateScenario("p1"));

    result.current.mutate({ scenarioId: "s1", name: "Apple falls (copy)" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["scenarios", "p1"], exact: true });
  });
});
