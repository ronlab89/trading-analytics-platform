import { act, renderHook, waitFor } from "@testing-library/react";
import type { NotificationResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput } from "@/api/trading-client";
import { useNotifications } from "@/features/dashboard/hooks/use-notifications";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useMarkAllNotificationsRead } from "./use-mark-all-notifications-read";
import { useMarkNotificationRead } from "./use-mark-notification-read";

function notification(id: string, readAt: string | null = null): NotificationResponse {
  return {
    id,
    userId: "u1",
    type: "TEST",
    title: id,
    message: "Message",
    severity: "INFO",
    readAt,
    createdAt: "2026-11-05T14:00:00.000Z",
    metadata: {},
  };
}

/**
 * The server holds `held`. Marking answers when the test says so (`finish` or `refuse`), so the
 * state between the click and the answer can be looked at.
 */
function setup() {
  const held = [notification("n1"), notification("n2")];
  let settle: ((outcome: "ok" | "refused") => void) | undefined;
  const call = vi.fn((operation: { operationId: string }, _input?: CallInput) => {
    if (operation.operationId === "listNotifications") {
      return Promise.resolve({ data: held.map((n) => ({ ...n })) });
    }
    return new Promise<unknown>((resolve, reject) => {
      settle = (outcome) => {
        if (outcome === "ok") {
          held.forEach((n) => {
            n.readAt = "2026-11-05T16:00:00.000Z";
          });
          resolve({ data: undefined });
        } else {
          reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503));
        }
      };
    });
  });
  const view = renderHook(
    () => ({
      list: useNotifications(),
      markOne: useMarkNotificationRead(),
      markAll: useMarkAllNotificationsRead(),
    }),
    { wrapper: tradingClientWrapper({ call }) },
  );
  const readAts = () => view.result.current.list.data?.map(({ readAt }) => readAt !== null);
  return {
    call,
    readAts,
    finish: () => settle?.("ok"),
    refuse: () => settle?.("refused"),
    ...view,
  };
}

async function loaded(ctx: ReturnType<typeof setup>) {
  await waitFor(() => {
    expect(ctx.readAts()).toEqual([false, false]);
  });
}

describe("useMarkNotificationRead", () => {
  it("asks the server to mark that notification", async () => {
    const ctx = setup();
    await loaded(ctx);

    act(() => {
      ctx.result.current.markOne.mutate("n1");
    });

    await waitFor(() => {
      expect(ctx.call).toHaveBeenCalledWith(
        expect.objectContaining({ operationId: "markNotificationRead" }),
        { params: { notificationId: "n1" } },
      );
    });
  });

  it("shows it read before the server answers, and no other", async () => {
    const ctx = setup();
    await loaded(ctx);

    act(() => {
      ctx.result.current.markOne.mutate("n1");
    });

    await waitFor(() => {
      expect(ctx.readAts()).toEqual([true, false]);
    });
  });

  it("puts it back as it was when the server refuses", async () => {
    const ctx = setup();
    await loaded(ctx);
    act(() => {
      ctx.result.current.markOne.mutate("n1");
    });
    await waitFor(() => {
      expect(ctx.readAts()).toEqual([true, false]);
    });

    act(() => {
      ctx.refuse();
    });

    await waitFor(() => {
      expect(ctx.result.current.markOne.isError).toBe(true);
    });
    await waitFor(() => {
      expect(ctx.readAts()).toEqual([false, false]);
    });
  });

  it("reads the list again once the server answers", async () => {
    const ctx = setup();
    await loaded(ctx);
    const readsBefore = ctx.call.mock.calls.filter(
      ([operation]) => operation.operationId === "listNotifications",
    ).length;
    act(() => {
      ctx.result.current.markOne.mutate("n1");
    });
    await waitFor(() => {
      expect(ctx.readAts()).toEqual([true, false]);
    });

    act(() => {
      ctx.finish();
    });

    await waitFor(() => {
      expect(
        ctx.call.mock.calls.filter(([operation]) => operation.operationId === "listNotifications")
          .length,
      ).toBeGreaterThan(readsBefore);
    });
  });
});

describe("useMarkAllNotificationsRead", () => {
  it("asks the server to mark them all and shows them read before it answers", async () => {
    const ctx = setup();
    await loaded(ctx);

    act(() => {
      ctx.result.current.markAll.mutate();
    });

    await waitFor(() => {
      expect(ctx.readAts()).toEqual([true, true]);
    });
    expect(ctx.call).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: "markAllNotificationsRead" }),
    );
  });

  it("puts them back as they were when the server refuses", async () => {
    const ctx = setup();
    await loaded(ctx);
    act(() => {
      ctx.result.current.markAll.mutate();
    });
    await waitFor(() => {
      expect(ctx.readAts()).toEqual([true, true]);
    });

    act(() => {
      ctx.refuse();
    });

    await waitFor(() => {
      expect(ctx.result.current.markAll.isError).toBe(true);
    });
    await waitFor(() => {
      expect(ctx.readAts()).toEqual([false, false]);
    });
  });

  it("keeps them read once the server confirms", async () => {
    const ctx = setup();
    await loaded(ctx);
    act(() => {
      ctx.result.current.markAll.mutate();
    });
    // The request goes out after the optimistic change, so wait for it before answering.
    await waitFor(() => {
      expect(ctx.readAts()).toEqual([true, true]);
    });

    act(() => {
      ctx.finish();
    });

    await waitFor(() => {
      expect(ctx.result.current.markAll.isSuccess).toBe(true);
    });
    await waitFor(() => {
      expect(ctx.readAts()).toEqual([true, true]);
    });
  });
});
