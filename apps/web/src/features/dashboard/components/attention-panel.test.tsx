import type { NotificationResponse } from "@trading/contracts";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import "@/i18n";
import { AttentionPanel } from "./attention-panel";

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

function renderPanel(answer: () => Promise<unknown>) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  const Wrapper = tradingClientWrapper({ call });
  render(
    <Wrapper>
      <AttentionPanel />
    </Wrapper>,
  );
  return call;
}

describe("AttentionPanel", () => {
  it("announces the loading while the first answer is on its way", () => {
    renderPanel(() => new Promise(() => undefined));

    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading the notifications" })).toBeInTheDocument();
  });

  it("lists the unread notifications with their kind, title and message, newest first", async () => {
    const old = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const recent = new Date(Date.now() - 3 * 3_600_000).toISOString();
    renderPanel(() =>
      Promise.resolve({
        data: [notification("a", "INFO", old), notification("b", "WARNING", recent)],
      }),
    );

    const items = within(await screen.findByRole("list")).getAllByRole("listitem");

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Alert");
    expect(items[0]).toHaveTextContent("Title b");
    expect(items[0]).toHaveTextContent("Message b · 3 hr. ago");
    expect(items[1]).toHaveTextContent("Info");
    expect(items[1]).toHaveTextContent("2 days ago");
  });

  it("counts every unread notification, not only the ones it lists", async () => {
    renderPanel(() =>
      Promise.resolve({
        data: ["a", "b", "c", "d", "e"].map((id, index) =>
          notification(id, "INFO", `2026-10-0${String(index + 1)}T10:00:00.000Z`),
        ),
      }),
    );

    expect(await screen.findByLabelText("5 unread")).toHaveTextContent("5");
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(3);
  });

  it("says nothing needs attention when everything is read", async () => {
    renderPanel(() =>
      Promise.resolve({
        data: [notification("a", "INFO", "2026-10-01T10:00:00.000Z", "2026-10-01T11:00:00.000Z")],
      }),
    );

    expect(await screen.findByText("Nothing needs your attention")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("fails on its own and tries again when asked", async () => {
    let failing = true;
    const call = renderPanel(() =>
      failing
        ? Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503))
        : Promise.resolve({ data: [notification("a", "ERROR", "2026-10-01T10:00:00.000Z")] }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the notifications");

    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Title a")).toBeInTheDocument();
    expect(call).toHaveBeenCalledTimes(2);
  });
});
