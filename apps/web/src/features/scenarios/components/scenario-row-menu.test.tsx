import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import type { ScenarioRow } from "../types";
import { ScenarioRowMenu } from "./scenario-row-menu";

const scenario: ScenarioRow = {
  id: "s1",
  name: "Apple falls",
  status: "SAVED",
  updatedAt: "2026-10-12T12:00:00.000Z",
  mainChange: null,
  otherChanges: 0,
  figures: null,
  figuresState: "loading",
};

function renderMenu() {
  const actions = { onDuplicate: vi.fn(), onDelete: vi.fn() };
  const view = render(<ScenarioRowMenu actions={actions} scenario={scenario} />);
  return { actions, view };
}

const openMenu = () =>
  userEvent.click(screen.getByRole("button", { name: "Actions for “Apple falls”" }));

describe("ScenarioRowMenu", () => {
  it("offers a trigger that names the scenario it acts on", () => {
    renderMenu();

    expect(screen.getByRole("button", { name: "Actions for “Apple falls”" })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("lists duplicate and delete, and nothing that has nowhere to go yet", async () => {
    renderMenu();

    await openMenu();

    const menu = within(screen.getByRole("menu"));
    expect(menu.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Duplicate",
      "Delete",
    ]);
  });

  it.each([
    ["Duplicate", "onDuplicate"],
    ["Delete", "onDelete"],
  ] as const)("calls %s with the scenario and closes the menu", async (label, handler) => {
    const { actions } = renderMenu();
    await openMenu();

    await userEvent.click(screen.getByRole("menuitem", { name: label }));

    expect(actions[handler]).toHaveBeenCalledExactlyOnceWith(scenario);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("has no accessibility violations, closed and open", async () => {
    const { view } = renderMenu();
    expect(await axe(view.container)).toHaveNoViolations();

    await openMenu();
    expect(await axe(screen.getByRole("menu"))).toHaveNoViolations();
  });
});
