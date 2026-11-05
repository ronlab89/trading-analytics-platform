import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { NotificationButton } from "./notification-button";

describe("NotificationButton", () => {
  it.each([
    [{ kind: "none" }, "Notifications"],
    [{ kind: "dot" }, "Notifications"],
    [{ kind: "count", count: 3 }, "Notifications, 3 unread"],
  ] as const)("names the bell for the %o unread state", (unread, name) => {
    render(<NotificationButton unread={unread} />);

    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("caps the unread count at 9+", () => {
    render(<NotificationButton unread={{ kind: "count", count: 12 }} />);

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("passes what it is given on to the button, so it can be a trigger", async () => {
    const onClick = vi.fn();
    render(<NotificationButton aria-expanded={true} onClick={onClick} unread={{ kind: "none" }} />);

    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
