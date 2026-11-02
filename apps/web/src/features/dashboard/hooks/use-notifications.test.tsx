import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useNotifications } from "./use-notifications";

function clientAnswering(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  return { client: { call } as TradingClient, call };
}

describe("useNotifications", () => {
  it("gets the notifications of the user through the listNotifications operation", async () => {
    const notifications = [{ id: "n1", title: "Risk level exceeded" }];
    const { client, call } = clientAnswering(() => Promise.resolve({ data: notifications }));
    const { result } = renderHook(() => useNotifications(), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(notifications);
    expect(call.mock.calls[0]?.[0].operationId).toBe("listNotifications");
  });

  it("exposes the API error so a panel can say it failed", async () => {
    const { client } = clientAnswering(() =>
      Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503)),
    );
    const { result } = renderHook(() => useNotifications(), {
      wrapper: tradingClientWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({ code: "DEPENDENCY_ERROR", status: 503 });
  });
});
