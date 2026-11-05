import { act, renderHook, waitFor } from "@testing-library/react";
import type { NotificationResponse, RealtimeEvent } from "@trading/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotifications } from "@/features/dashboard/hooks/use-notifications";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useNotificationUpdates } from "./use-notification-updates";

const toast = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function notification(
  id: string,
  severity: NotificationResponse["severity"],
  readAt: string | null = null,
): NotificationResponse {
  return {
    id,
    userId: "u1",
    type: "TEST",
    title: `Title ${id}`,
    message: `Message ${id}`,
    severity,
    readAt,
    createdAt: "2026-11-05T14:00:00.000Z",
    metadata: {},
  };
}

function created(notificationId: string, type = "NOTIFICATION_CREATED"): RealtimeEvent {
  return {
    id: "e1",
    type,
    channel: "notifications",
    sequence: 1,
    timestamp: "2026-11-05T14:30:01.000Z",
    epoch: "epoch-1",
    payload: { notificationId },
  } as unknown as RealtimeEvent;
}

/** The server holds `held`; a notification "arrives" when the test adds it before the event. */
function setup() {
  const held: NotificationResponse[] = [notification("n0", "INFO")];
  const call = vi.fn(() => Promise.resolve({ data: [...held] }));
  const realtime = createFakeRealtimeClient("connected");
  const view = renderHook(
    () => {
      // The shell reads the list too, which is what makes the query active.
      const list = useNotifications();
      useNotificationUpdates();
      return list;
    },
    { wrapper: tradingClientWrapper({ call }, undefined, realtime) },
  );
  return { held, call, realtime, ...view };
}

beforeEach(() => {
  toast.warning.mockClear();
  toast.error.mockClear();
});

describe("useNotificationUpdates", () => {
  it("listens to the notifications channel, and leaves it when it unmounts", () => {
    const { realtime, unmount } = setup();

    expect(realtime.subscribedChannels()).toEqual(["notifications"]);
    unmount();

    expect(realtime.subscribedChannels()).toEqual([]);
  });

  it("reads the notifications again when one is created", async () => {
    const { held, realtime, result } = setup();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    held.push(notification("n1", "INFO"));
    act(() => {
      realtime.emit(created("n1"));
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
  });

  it.each([
    ["WARNING", "warning"],
    ["ERROR", "error"],
  ] as const)("tells the user about a new %s notification", async (severity, method) => {
    const { held, realtime, result } = setup();
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    held.push(notification("n1", severity));
    act(() => {
      realtime.emit(created("n1"));
    });

    await waitFor(() => {
      expect(toast[method]).toHaveBeenCalledWith("Title n1", {
        id: "n1",
        description: "Message n1",
      });
    });
  });

  it.each(["INFO", "SUCCESS"] as const)(
    "only moves the count for a new %s notification",
    async (severity) => {
      const { held, realtime, result } = setup();
      await waitFor(() => {
        expect(result.current.data).toHaveLength(1);
      });

      held.push(notification("n1", severity));
      act(() => {
        realtime.emit(created("n1"));
      });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });
      expect(toast.warning).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    },
  );

  it("says nothing about a notification that is already read", async () => {
    const { held, realtime, result } = setup();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    held.push(notification("n1", "WARNING", "2026-11-05T15:00:00.000Z"));
    act(() => {
      realtime.emit(created("n1"));
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("says nothing when the notification is not in the list it read", async () => {
    const { realtime, result } = setup();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    act(() => {
      realtime.emit(created("n9"));
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("ignores the triggered alert, which comes with its own notification", async () => {
    const { call, held, realtime, result } = setup();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    const readsBefore = call.mock.calls.length;

    held.push(notification("n1", "WARNING"));
    act(() => {
      realtime.emit(created("n1", "ALERT_TRIGGERED"));
    });

    expect(call.mock.calls.length).toBe(readsBefore);
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
