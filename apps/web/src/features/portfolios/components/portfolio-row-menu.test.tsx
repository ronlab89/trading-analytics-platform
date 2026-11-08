import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import type { PortfolioRow } from "../types";
import { PortfolioRowMenu } from "./portfolio-row-menu";

const portfolio: PortfolioRow = {
  id: "p1",
  name: "Conservative",
  baseCurrency: "USD",
  status: "ACTIVE",
};

function renderMenu(overrides: { portfolio?: PortfolioRow; inUse?: boolean } = {}) {
  const actions = { onUse: vi.fn(), onEdit: vi.fn(), onArchive: vi.fn() };
  render(
    <PortfolioRowMenu
      inUse={overrides.inUse ?? false}
      portfolio={overrides.portfolio ?? portfolio}
      {...actions}
    />,
  );
  return actions;
}

const openMenu = () =>
  userEvent.click(screen.getByRole("button", { name: "Actions for “Conservative”" }));

describe("PortfolioRowMenu", () => {
  it("offers a trigger that names the portfolio it acts on", () => {
    renderMenu();

    expect(screen.getByRole("button", { name: "Actions for “Conservative”" })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("lists use, edit and archive, and leaves out what the API cannot do yet", async () => {
    renderMenu();

    await openMenu();

    const menu = within(screen.getByRole("menu"));
    expect(menu.getByRole("menuitemcheckbox", { name: "Use this portfolio" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Archive" })).toBeInTheDocument();
    expect(menu.getAllByRole("menuitem")).toHaveLength(2);
    expect(menu.queryByText(/Delete|Restore/)).not.toBeInTheDocument();
  });

  it.each([
    ["Use this portfolio", "onUse"],
    ["Edit", "onEdit"],
    ["Archive", "onArchive"],
  ] as const)("calls %s with the portfolio id and closes the menu", async (label, handler) => {
    const actions = renderMenu();
    await openMenu();

    await userEvent.click(screen.getByText(label));

    expect(actions[handler]).toHaveBeenCalledWith("p1");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("marks the portfolio in use as the one already chosen", async () => {
    renderMenu({ inUse: true });
    await openMenu();

    expect(screen.getByRole("menuitemcheckbox", { name: "Use this portfolio" })).toBeChecked();
  });

  it("does not mark a portfolio that is not in use", async () => {
    renderMenu({ inUse: false });
    await openMenu();

    expect(screen.getByRole("menuitemcheckbox", { name: "Use this portfolio" })).not.toBeChecked();
  });

  it("renders nothing for an archived portfolio, which can be neither used, edited nor archived", () => {
    renderMenu({ portfolio: { ...portfolio, status: "ARCHIVED" } });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("has no accessibility violations, closed and open", async () => {
    const { container } = render(
      <PortfolioRowMenu
        inUse={false}
        onArchive={vi.fn()}
        onEdit={vi.fn()}
        onUse={vi.fn()}
        portfolio={portfolio}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();

    await openMenu();

    expect(await axe(screen.getByRole("menu"))).toHaveNoViolations();
  });
});
