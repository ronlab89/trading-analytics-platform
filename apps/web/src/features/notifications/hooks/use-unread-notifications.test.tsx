import { renderHook, waitFor } from "@testing-library/react";
import type { NotificationResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { ApiError, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useUnreadNotifications } from "./use-unread-notifications";

function notification(
  id: string,
  severity: NotificationResponse["severity"],
  readAt: string | null = null,
): NotificationResponse {
  return {
    id,
    userId: "u1",
    type: "TEST",
    title: id,
    message: "Message",
    severity,
    readAt,
    createdAt: "2026-11-05T14:00:00.000Z",
    metadata: {},
  };
}

function render(answer: () => Promise<unknown>) {
  const client: TradingClient = { call: answer };
  return renderHook(() => useUnreadNotifications(), { wrapper: tradingClientWrapper(client) });
}

describe("useUnreadNotifications", () => {
  it("shows the dot while the notifications load, because the count is not known", () => {
    const { result } = render(() => new Promise(() => undefined));

    expect(result.current).toEqual({ unread: { kind: "dot" }, alerts: 0 });
  });

  it("shows the unread count and the alerts once they arrive", async () => {
    const { result } = render(() =>
      Promise.resolve({
        data: [
          notification("n1", "WARNING"),
          notification("n2", "INFO"),
          notification("n3", "ERROR", "2026-11-05T15:00:00.000Z"),
        ],
      }),
    );

    await waitFor(() => {
      expect(result.current.unread).toEqual({ kind: "count", count: 2 });
    });
    expect(result.current.alerts).toBe(1);
  });

  it("shows nothing when everything was read", async () => {
    const { result } = render(() =>
      Promise.resolve({ data: [notification("n1", "WARNING", "2026-11-05T15:00:00.000Z")] }),
    );

    await waitFor(() => {
      expect(result.current.unread).toEqual({ kind: "none" });
    });
    expect(result.current.alerts).toBe(0);
  });

  it("keeps the dot when the notifications could not be loaded", async () => {
    const { result } = render(() =>
      Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503)),
    );

    // The query retries before it fails, so wait for the error state to settle.
    await waitFor(
      () => {
        expect(result.current.unread).toEqual({ kind: "dot" });
      },
      { timeout: 4_000 },
    );
    expect(result.current.alerts).toBe(0);
  });
});
