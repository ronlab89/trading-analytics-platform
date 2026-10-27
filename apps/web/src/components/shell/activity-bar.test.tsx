import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActivityBar } from "./activity-bar";

function renderBar(path = "/", handlers = { onViewProfile: vi.fn(), onSignOut: vi.fn() }) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <ActivityBar userInitials="JD" {...handlers} />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

describe("ActivityBar", () => {
  it("links the seven views and settings, each with an accessible name", () => {
    renderBar();

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const names = screen.getAllByRole("link").map((link) => link.getAttribute("aria-label"));

    expect(nav).toBeInTheDocument();
    expect(names).toEqual([
      "Home",
      "Portfolios",
      "Transactions",
      "Analytics",
      "Markets",
      "Decision Center",
      "Activity",
      "Settings",
    ]);
  });

  it("marks only the current view with aria-current", () => {
    renderBar("/portfolios");

    expect(screen.getByRole("link", { name: "Portfolios" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("keeps Home marked on an unknown path", () => {
    renderBar("/does-not-exist");

    expect(screen.getByRole("link", { current: "page" })).toHaveAccessibleName("Home");
  });

  it("opens the user menu with the profile and sign out actions", async () => {
    const handlers = { onViewProfile: vi.fn(), onSignOut: vi.fn() };
    renderBar("/", handlers);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "User menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(handlers.onSignOut).toHaveBeenCalledOnce();
    expect(handlers.onViewProfile).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderBar();

    expect(await axe(container)).toHaveNoViolations();
  });
});
