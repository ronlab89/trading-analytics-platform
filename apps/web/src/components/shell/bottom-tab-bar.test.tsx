import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { BottomTabBar } from "./bottom-tab-bar";

function renderBar(path = "/") {
  const router = createMemoryRouter([{ path: "*", element: <BottomTabBar /> }], {
    initialEntries: [path],
  });

  return render(<RouterProvider router={router} />);
}

describe("BottomTabBar", () => {
  it("shows the four tabs and More", () => {
    renderBar();

    const nav = screen.getByRole("navigation", { name: "Main tabs" });

    for (const name of ["Home", "Portfolios", "Transactions", "Markets"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("marks the current tab", () => {
    renderBar("/portfolios");

    expect(screen.getByRole("link", { name: "Portfolios" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("opens a sheet with the other views and marks the current one", async () => {
    const user = userEvent.setup();
    renderBar("/analytics");

    await user.click(screen.getByRole("button", { name: "More" }));
    const sheet = screen.getByRole("dialog", { name: "More" });

    for (const name of ["Analytics", "Decision Center", "Activity", "Settings"]) {
      expect(within(sheet).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(sheet).getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("closes the sheet when a view is chosen", async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(screen.getByRole("link", { name: "Activity" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const user = userEvent.setup();
    const { container } = renderBar();

    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "More" }));

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
