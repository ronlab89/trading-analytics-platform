import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NotificationResponse } from "@trading/contracts";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { NotificationsPanel } from "./notifications-panel";

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

const list = [
  notification("n1", "WARNING", "2026-11-05T14:00:00.000Z"),
  notification("n2", "INFO", "2026-11-05T13:00:00.000Z"),
  notification("n3", "SUCCESS", "2026-11-05T12:00:00.000Z", "2026-11-05T12:30:00.000Z"),
];

function renderPanel(props: Partial<Parameters<typeof NotificationsPanel>[0]> = {}) {
  const handlers = {
    onRetry: vi.fn(),
    onRead: vi.fn(),
    onReadAll: vi.fn(),
    onNavigate: vi.fn(),
  };
  const view = render(
    <MemoryRouter>
      <NotificationsPanel failed={false} notifications={list} {...handlers} {...props} />
    </MemoryRouter>,
  );
  return { ...handlers, ...view };
}

/** The list item at that place; a missing one fails the test with a clear reason. */
function item(items: HTMLElement[], index: number): HTMLElement {
  const found = items.at(index);
  if (!found) throw new Error(`The panel has no row ${String(index)}`);
  return found;
}

describe("NotificationsPanel", () => {
  it("lists each notification with its title and message, newest first", () => {
    renderPanel();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(item(items, 0)).getByText("Title n1")).toBeInTheDocument();
    expect(within(item(items, 0)).getByText("Message n1")).toBeInTheDocument();
    expect(within(item(items, 2)).getByText("Title n3")).toBeInTheDocument();
  });

  it("names the severity of each one for a screen reader", () => {
    renderPanel();

    const items = screen.getAllByRole("listitem");
    expect(within(item(items, 0)).getByText("Warning:")).toBeInTheDocument();
    expect(within(item(items, 1)).getByText("Info:")).toBeInTheDocument();
  });

  it("marks the unread ones, as a button, and leaves the read ones as plain text", () => {
    renderPanel();

    expect(screen.getAllByText("Unread")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Title n/ })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Title n3/ })).not.toBeInTheDocument();
  });

  it("marks a notification as read when the user clicks it", async () => {
    const { onRead } = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /Title n2/ }));

    expect(onRead).toHaveBeenCalledWith("n2");
  });

  it("marks them all as read from the bottom of the panel", async () => {
    const { onReadAll } = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    expect(onReadAll).toHaveBeenCalledTimes(1);
  });

  it("does not offer to mark all as read when everything was read", () => {
    renderPanel({
      notifications: [
        notification("n3", "SUCCESS", "2026-11-05T12:00:00.000Z", "2026-11-05T12:30:00.000Z"),
      ],
    });

    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
  });

  it("links to Activity and tells the container when the user follows it", async () => {
    const { onNavigate } = renderPanel();

    const link = screen.getByRole("link", { name: "View all activity" });
    expect(link).toHaveAttribute("href", "/activity");
    await userEvent.click(link);

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("lists at most eight, the newest", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      notification(
        `m${String(i)}`,
        "INFO",
        `2026-11-05T${String(10 + i).padStart(2, "0")}:00:00.000Z`,
      ),
    );

    renderPanel({ notifications: many });

    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByText("Title m9")).toBeInTheDocument();
    expect(screen.queryByText("Title m1")).not.toBeInTheDocument();
  });

  it("announces the loading state while the notifications have not arrived", () => {
    renderPanel({ notifications: undefined });

    expect(screen.getByRole("status", { name: "Loading the notifications" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("says the user is all caught up when there are none", () => {
    renderPanel({ notifications: [] });

    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("explains a failed load and retries it on demand", async () => {
    const { onRetry } = renderPanel({ notifications: undefined, failed: true });

    expect(screen.getByText("Couldn't load the notifications")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the list it has when a later read fails", () => {
    renderPanel({ failed: true });

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Couldn't load the notifications")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPanel();

    expect(await axe(container)).toHaveNoViolations();
  });
});
