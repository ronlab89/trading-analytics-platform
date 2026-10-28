import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import type { PortfolioOption } from "./portfolio-selector";
import { TopBar } from "./top-bar";

const portfolios: readonly PortfolioOption[] = [
  { id: "growth", name: "Crecimiento", currency: "USD", initials: "CR" },
  { id: "conservative", name: "Conservador", currency: "USD", initials: "CO" },
];

function renderTopBar(overrides: Partial<Parameters<typeof TopBar>[0]> = {}, path = "/") {
  const props = {
    portfolios,
    selectedPortfolioId: "growth",
    unread: { kind: "none" },
    userName: "Jane Doe",
    userInitials: "JD",
    onSelectPortfolio: vi.fn(),
    onOpenNotifications: vi.fn(),
    onSimulateConnectionIssue: vi.fn(),
    onSendTestNotification: vi.fn(),
    onResetDemo: vi.fn(),
    onViewProfile: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  } as const;
  const router = createMemoryRouter([{ path: "*", element: <TopBar {...props} /> }], {
    initialEntries: [path],
  });

  return { props, ...render(<RouterProvider router={router} />) };
}

describe("TopBar", () => {
  it("shows the selected portfolio with its currency", () => {
    renderTopBar();

    expect(screen.getByRole("button", { name: "Select portfolio" })).toHaveTextContent(
      "Crecimiento",
    );
    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("marks the current view in the breadcrumb", () => {
    renderTopBar({}, "/analytics");

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toHaveAttribute("aria-current", "page");
  });

  it("keeps Home in the breadcrumb on an unknown path", () => {
    renderTopBar({}, "/nowhere");

    expect(screen.getByText("Home")).toHaveAttribute("aria-current", "page");
  });

  it("selects another portfolio from the menu", async () => {
    const user = userEvent.setup();
    const { props } = renderTopBar();

    await user.click(screen.getByRole("button", { name: "Select portfolio" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Conservador" }));

    expect(props.onSelectPortfolio).toHaveBeenCalledWith("conservative");
  });

  it("runs the demo controls from the menu", async () => {
    const user = userEvent.setup();
    const { props } = renderTopBar();

    await user.click(screen.getByRole("button", { name: "Demo data" }));
    await user.click(screen.getByRole("menuitem", { name: "Reset demo" }));

    expect(props.onResetDemo).toHaveBeenCalledOnce();
  });

  it.each([
    [{ kind: "none" }, "Notifications"],
    [{ kind: "dot" }, "Notifications"],
    [{ kind: "count", count: 3 }, "Notifications, 3 unread"],
  ] as const)("names the bell for the %o unread state", (unread, name) => {
    renderTopBar({ unread });

    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("caps the unread count at 9+", () => {
    renderTopBar({ unread: { kind: "count", count: 12 } });

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("opens the notifications from the bell", async () => {
    const user = userEvent.setup();
    const { props } = renderTopBar();

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(props.onOpenNotifications).toHaveBeenCalledOnce();
  });

  it("signs out from the user menu", async () => {
    const user = userEvent.setup();
    const { props } = renderTopBar();

    await user.click(screen.getByRole("button", { name: "User menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(props.onSignOut).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderTopBar({ unread: { kind: "count", count: 3 } });

    expect(await axe(container)).toHaveNoViolations();
  });
});
