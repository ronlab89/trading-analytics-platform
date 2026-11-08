import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { ScenarioRow } from "../types";
import { ScenariosView } from "./scenarios-view";

const usd = (amount: string) => ({ amount, currency: "USD" });

function row(overrides: Partial<ScenarioRow> & Pick<ScenarioRow, "id" | "name">): ScenarioRow {
  return {
    status: "SAVED",
    updatedAt: "2026-10-12T12:00:00.000Z",
    mainChange: { assetId: "a1", symbol: "AAPL", percentChange: -10 },
    otherChanges: 0,
    figures: { base: usd("125430.00"), withScenario: usd("121416.00"), impactPercent: -3.2 },
    figuresState: "ready",
    ...overrides,
  };
}

const appleFalls = row({ id: "s1", name: "Apple falls" });
const microsoftRallies = row({
  id: "s2",
  name: "Microsoft rallies",
  mainChange: { assetId: "a2", symbol: "MSFT", percentChange: 5 },
  otherChanges: 2,
  figures: { base: usd("125430.00"), withScenario: usd("127186.00"), impactPercent: 1.4 },
});
const waiting = row({
  id: "s3",
  name: "Still calculating",
  mainChange: { assetId: "a3", symbol: "KO", percentChange: 3 },
  figures: null,
  figuresState: "loading",
});
const rows = [appleFalls, microsoftRallies, waiting];

const names = () =>
  within(screen.getByRole("table"))
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent);

describe("ScenariosView", () => {
  it("lists the scenarios with their main variable and their figures", () => {
    render(<ScenariosView rows={rows} />);

    const apple = screen.getByRole("row", { name: /Apple falls/ });
    expect(within(apple).getByText("AAPL price")).toBeInTheDocument();
    expect(within(apple).getByText("$125,430.00")).toBeInTheDocument();
    expect(within(apple).getByText("$121,416.00")).toBeInTheDocument();
    expect(within(apple).getByText("-3.20%")).toBeInTheDocument();
    expect(within(apple).getByText("Oct 12")).toBeInTheDocument();
  });

  it("counts the other changes next to the main variable", () => {
    render(<ScenariosView rows={rows} />);

    const microsoft = screen.getByRole("row", { name: /Microsoft rallies/ });
    expect(within(microsoft).getByText("MSFT price")).toBeInTheDocument();
    expect(within(microsoft).getByText("+2")).toBeInTheDocument();
  });

  it("says so in a scenario that changes nothing", () => {
    render(
      <ScenariosView
        rows={[row({ id: "s4", name: "Untouched", mainChange: null, otherChanges: 0 })]}
      />,
    );

    expect(screen.getByText("No changes")).toBeInTheDocument();
  });

  it("holds the place of the figures that are still being calculated", () => {
    render(<ScenariosView rows={rows} />);

    const pending = screen.getByRole("row", { name: /Still calculating/ });
    expect(within(pending).getAllByText("Calculating").length).toBeGreaterThan(0);
    expect(within(pending).queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("says that the figures of a scenario could not be calculated, and keeps the others", () => {
    render(
      <ScenariosView
        rows={[
          row({ id: "s5", name: "Broken", figures: null, figuresState: "failed" }),
          appleFalls,
        ]}
      />,
    );

    const broken = screen.getByRole("row", { name: /Broken/ });
    expect(within(broken).getAllByText("Could not be calculated").length).toBeGreaterThan(0);
    expect(screen.getByText("$121,416.00")).toBeInTheDocument();
  });

  it("finds a scenario by its name or by the symbol of its main variable", async () => {
    const user = userEvent.setup();
    render(<ScenariosView rows={rows} />);

    await user.type(screen.getByRole("searchbox", { name: "Search scenario" }), "msft");
    expect(names()).toEqual(["Microsoft rallies"]);
  });

  it("offers to clear a search that finds nothing", async () => {
    const user = userEvent.setup();
    render(<ScenariosView rows={rows} />);

    await user.type(screen.getByRole("searchbox", { name: "Search scenario" }), "zzz");
    expect(screen.getByText('No scenario matches "zzz".')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear the search" }));
    expect(names()).toHaveLength(3);
  });

  it("sorts by impact, and a scenario without figures goes last either way", async () => {
    const user = userEvent.setup();
    render(<ScenariosView rows={rows} />);

    await user.click(screen.getByRole("button", { name: /Impact/ }));
    expect(names()).toEqual(["Apple falls", "Microsoft rallies", "Still calculating"]);

    await user.click(screen.getByRole("button", { name: /Impact/ }));
    expect(names()).toEqual(["Microsoft rallies", "Apple falls", "Still calculating"]);
  });

  it("is a list of cards on a phone, with the value with the scenario and its impact", () => {
    render(<ScenariosView mobile rows={rows} />);

    const list = screen.getByRole("list", { name: "Scenarios" });
    const apple = within(list).getAllByRole("listitem")[0];
    expect(apple).toHaveTextContent("Apple falls");
    expect(apple).toHaveTextContent("AAPL price · Oct 12");
    expect(apple).toHaveTextContent("$121,416.00");
    expect(apple).toHaveTextContent("-3.20%");
    expect(within(list).getAllByText("Calculating").length).toBeGreaterThan(0);
  });

  it("has a menu in each row when it is given something to do", () => {
    render(
      <ScenariosView
        actions={{ onOpen: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() }}
        rows={rows}
      />,
    );

    expect(screen.getAllByRole("button", { name: /^Actions for/ })).toHaveLength(3);
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
  });

  it("has no menu without actions, nor on a phone", () => {
    const { rerender } = render(<ScenariosView rows={rows} />);
    expect(screen.queryByRole("button", { name: /^Actions for/ })).not.toBeInTheDocument();

    rerender(
      <ScenariosView
        actions={{ onOpen: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() }}
        mobile
        rows={rows}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Actions for/ })).not.toBeInTheDocument();
  });
});
