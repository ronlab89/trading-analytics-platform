import { render, screen, within } from "@testing-library/react";
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
    notifications: <button type="button">Bell stub</button>,
    userName: "Jane Doe",
    userInitials: "JD",
    onSelectPortfolio: vi.fn(),
    demo: {
      onSimulateConnectionIssue: vi.fn(),
      onSendTestNotification: vi.fn(),
      onResetDemo: vi.fn(),
    },
    onViewProfile: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  };
  const router = createMemoryRouter([{ path: "*", element: <TopBar {...props} /> }], {
    initialEntries: [path],
  });

  return { props, ...render(<RouterProvider router={router} />) };
}

describe("TopBar", () => {
  it("shows the selected portfolio with its currency", () => {
    renderTopBar();

    expect(screen.getByRole("button", { name: /Select portfolio/ })).toHaveTextContent(
      "Crecimiento",
    );
    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("marks the current view in the breadcrumb", () => {
    renderTopBar({}, "/analytics");

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toHaveAttribute("aria-current", "page");
  });

  it("adds the page title after the section, which becomes a link back to it", () => {
    renderTopBar({ pageTitle: "Experimental" }, "/portfolios/p3");

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Portfolios" })).toHaveAttribute(
      "href",
      "/portfolios",
    );
    expect(within(breadcrumb).getByText("Experimental")).toHaveAttribute("aria-current", "page");
    expect(within(breadcrumb).getByText("Portfolios")).not.toHaveAttribute("aria-current");
  });

  it("names the profile in the breadcrumb, which is not a view of the activity bar", () => {
    renderTopBar({}, "/profile");

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByText("Profile")).toHaveAttribute("aria-current", "page");
    expect(within(breadcrumb).queryByText("Home")).not.toBeInTheDocument();
  });

  it("keeps Home in the breadcrumb on an unknown path", () => {
    renderTopBar({}, "/nowhere");

    expect(screen.getByText("Home")).toHaveAttribute("aria-current", "page");
  });

  it("selects another portfolio from the menu", async () => {
    const user = userEvent.setup();
    const { props } = renderTopBar();

    await user.click(screen.getByRole("button", { name: /Select portfolio/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "Conservador" }));

    expect(props.onSelectPortfolio).toHaveBeenCalledWith("conservative");
  });

  it("runs the demo controls from the menu", async () => {
    const user = userEvent.setup();
    const { props } = renderTopBar();

    await user.click(screen.getByRole("button", { name: "Demo data" }));
    await user.click(screen.getByRole("menuitem", { name: "Reset demo" }));

    expect(props.demo?.onResetDemo).toHaveBeenCalledOnce();
  });

  it("has no demo menu without demo controls, as in the real build", () => {
    renderTopBar({ demo: undefined });

    expect(screen.queryByRole("button", { name: "Demo data" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bell stub" })).toBeInTheDocument();
  });

  it("shows the notifications the shell gives it, beside the demo controls", () => {
    renderTopBar();

    expect(screen.getByRole("button", { name: "Bell stub" })).toBeInTheDocument();
  });

  it("signs out from the user menu", async () => {
    const user = userEvent.setup();
    const { props } = renderTopBar();

    await user.click(screen.getByRole("button", { name: /User menu/ }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(props.onSignOut).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderTopBar();

    expect(await axe(container)).toHaveNoViolations();
  });
});
