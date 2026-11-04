import { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { UserPreferenceResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { usePreferences, useUpdatePreferences } from "./use-preferences";

const saved: UserPreferenceResponse = {
  userId: "u1",
  theme: "light",
  language: "es",
  defaultPortfolioId: "p1",
  reducedMotion: false,
  notificationPreferences: {},
  updatedAt: "2026-11-01T10:00:00.000Z",
};

type Answer = (operation: string, input?: CallInput) => Promise<unknown>;

function clientAnswering(answer: Answer) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => answer(operation.operationId, input),
  );
  return { client: { call } as TradingClient, call };
}

function both(client: TradingClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => ({ read: usePreferences(), write: useUpdatePreferences() }), {
    wrapper: tradingClientWrapper(client, queryClient),
  });
}

describe("usePreferences", () => {
  it("reads the preferences through the getPreferences operation", async () => {
    const { client, call } = clientAnswering(() => Promise.resolve({ data: saved }));
    const { result } = both(client);

    await waitFor(() => {
      expect(result.current.read.data).toEqual(saved);
    });
    expect(call.mock.calls[0]?.[0].operationId).toBe("getPreferences");
  });

  it("gives null, not an error, until the user has saved a preference", async () => {
    const { client } = clientAnswering(() => Promise.resolve({ data: null }));
    const { result } = both(client);

    await waitFor(() => {
      expect(result.current.read.isSuccess).toBe(true);
    });
    expect(result.current.read.data).toBeNull();
  });
});

describe("useUpdatePreferences", () => {
  it("patches only what it is given and shows the answer at once in the read query", async () => {
    const { client, call } = clientAnswering((operation) =>
      Promise.resolve({
        data: operation === "getPreferences" ? saved : { ...saved, language: "en" },
      }),
    );
    const { result } = both(client);
    await waitFor(() => {
      expect(result.current.read.data?.language).toBe("es");
    });

    await act(async () => {
      await result.current.write.mutateAsync({ language: "en" });
    });

    const patch = call.mock.calls.find(
      ([operation]) => operation.operationId === "updatePreferences",
    );
    expect(patch?.[1]).toEqual({ body: { language: "en" } });
    await waitFor(() => {
      expect(result.current.read.data?.language).toBe("en");
    });
    expect(
      call.mock.calls.filter(([operation]) => operation.operationId === "getPreferences"),
    ).toHaveLength(1);
  });

  it("keeps what it had and reports the error when the save is refused", async () => {
    const { client } = clientAnswering((operation) =>
      operation === "getPreferences"
        ? Promise.resolve({ data: saved })
        : Promise.reject(new ApiError("NOT_FOUND", "No such portfolio.", 404)),
    );
    const { result } = both(client);
    await waitFor(() => {
      expect(result.current.read.data).toEqual(saved);
    });

    await act(async () => {
      await result.current.write.mutateAsync({ defaultPortfolioId: "p9" }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.write.error).toBeInstanceOf(ApiError);
    });
    expect(result.current.read.data).toEqual(saved);
  });
});
