import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NotificationResponse } from "@trading/contracts";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { NotificationsMenu } from "./notifications-menu";

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function notification(
  id: string,
  severity: NotificationResponse["severity"],
  createdAt: string,
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
    createdAt,
    metadata: {},
  };
}

function setup({ refuse = false, phone = false } = {}) {
  if (phone) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("max-width: 560px"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  }
  const held = [
    notification("n1", "WARNING", "2026-11-05T14:00:00.000Z"),
    notification("n2", "INFO", "2026-11-05T13:00:00.000Z"),
  ];
  const call = vi.fn((operation: { operationId: string }, _input?: CallInput) => {
    if (operation.operationId === "listNotifications") {
      return Promise.resolve({ data: held.map((n) => ({ ...n })) });
    }
    return refuse
      ? Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503))
      : Promise.resolve({ data: undefined });
  });
  const Wrapper = tradingClientWrapper({ call });
  render(
    <Wrapper>
      <MemoryRouter>
        <NotificationsMenu unread={{ kind: "count", count: 2 }} />
      </MemoryRouter>
    </Wrapper>,
  );
  return { call };
}

async function openPanel() {
  await userEvent.click(screen.getByRole("button", { name: "Notifications, 2 unread" }));
  return screen.findByRole("dialog", { name: "Notifications" });
}

beforeEach(() => {
  toast.error.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotificationsMenu", () => {
  it("starts closed, with the bell naming the unread count", () => {
    setup();

    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the panel under the bell with the notifications of the user", async () => {
    setup();

    const panel = await openPanel();

    expect(await within(panel).findByText("Title n1")).toBeInTheDocument();
    expect(within(panel).getByText("Title n2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull();
  });

  it("closes with Escape and gives the focus back to the bell", async () => {
    setup();
    await openPanel();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toHaveFocus();
  });

  it("asks the server to mark a notification when the user clicks it", async () => {
    const { call } = setup();
    const panel = await openPanel();

    await userEvent.click(await within(panel).findByRole("button", { name: /Title n2/ }));

    await waitFor(() => {
      expect(call).toHaveBeenCalledWith(
        expect.objectContaining({ operationId: "markNotificationRead" }),
        { params: { notificationId: "n2" } },
      );
    });
  });

  it("asks the server to mark them all from the bottom of the panel", async () => {
    const { call } = setup();
    const panel = await openPanel();
    await within(panel).findByText("Title n1");

    await userEvent.click(within(panel).getByRole("button", { name: "Mark all as read" }));

    await waitFor(() => {
      expect(call).toHaveBeenCalledWith(
        expect.objectContaining({ operationId: "markAllNotificationsRead" }),
      );
    });
  });

  it("tells the user when the server refuses to mark one", async () => {
    setup({ refuse: true });
    const panel = await openPanel();

    await userEvent.click(await within(panel).findByRole("button", { name: /Title n2/ }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not mark the notification as read");
    });
  });

  it("closes the panel when the user goes to Activity", async () => {
    setup();
    const panel = await openPanel();

    await userEvent.click(within(panel).getByRole("link", { name: "View all activity" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("opens as a bottom sheet on the phone, with the same notifications", async () => {
    setup({ phone: true });

    const sheet = await openPanel();

    expect(await within(sheet).findByText("Title n1")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
  });

  it("has no accessibility violations once open", async () => {
    setup();
    const panel = await openPanel();
    await within(panel).findByText("Title n1");

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
