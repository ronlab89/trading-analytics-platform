import type { ScenarioComparisonResponse } from "@trading/contracts";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import type { ScenarioMainChange } from "../types";
import { ScenarioComparisonSection } from "./scenario-comparison-section";

const usd = (amount: string) => ({ amount, currency: "USD" });

const metrics = (total: string, pnl: string, percent: number) => ({
  totalValue: usd(total),
  investedValue: usd("100000.00"),
  unrealizedPnL: usd(pnl),
  unrealizedPnLPercent: percent,
});

const asset = (
  assetId: string,
  symbol: string | null,
  allocationPercent: number,
  allocationShift: number,
) => ({
  assetId,
  value: usd("1.00"),
  valueDifference: usd("0.00"),
  allocationPercent,
  allocationShift,
  symbol,
  name: null,
});

const comparison: ScenarioComparisonResponse = {
  baseline: {
    metrics: metrics("125430.00", "25430.00", 6.12),
    assets: [
      { assetId: "a1", value: usd("1.00"), allocationPercent: 32, symbol: "AAPL", name: null },
      { assetId: "a2", value: usd("1.00"), allocationPercent: 28, symbol: null, name: null },
    ],
  },
  scenarios: [
    {
      scenarioId: "s1",
      name: "Apple falls",
      status: "SAVED",
      metrics: metrics("121416.00", "21416.00", 2.9),
      difference: {
        totalValue: usd("-4014.00"),
        totalValuePercent: -3.2,
        unrealizedPnL: usd("-4014.00"),
      },
      assets: [asset("a1", "AAPL", 29.8, -2.2), asset("a2", null, 28.9, 0.9)],
      unmatchedAssetIds: [],
    },
    {
      scenarioId: "s2",
      name: "Microsoft rallies",
      status: "DRAFT",
      metrics: metrics("127186.00", "27186.00", 7.55),
      difference: {
        totalValue: usd("1756.00"),
        totalValuePercent: 1.4,
        unrealizedPnL: usd("1756.00"),
      },
      assets: [asset("a1", "AAPL", 31.6, -0.4), asset("a2", null, 29.5, 1.5)],
      unmatchedAssetIds: ["a9"],
    },
  ],
};

const mainChanges = new Map<string, ScenarioMainChange | null>([
  ["s1", { assetId: "a1", symbol: "AAPL", percentChange: -10 }],
  ["s2", null],
]);

function renderSection(overrides: Partial<Parameters<typeof ScenarioComparisonSection>[0]> = {}) {
  const onRetry = vi.fn();
  const view = render(
    <ScenarioComparisonSection
      comparison={comparison}
      isError={false}
      mainChanges={mainChanges}
      onRetry={onRetry}
      portfolioName="Growth"
      {...overrides}
    />,
  );
  return { onRetry, view };
}

const card = (name: string) => screen.getByRole("region", { name });

describe("ScenarioComparisonSection", () => {
  it("has a card for the base and one for each scenario, with its letter", () => {
    renderSection();

    expect(within(card("Base")).getByText("Growth without changes")).toBeInTheDocument();
    expect(within(card("Apple falls")).getByText("Scenario A")).toBeInTheDocument();
    expect(within(card("Microsoft rallies")).getByText("Scenario B")).toBeInTheDocument();
  });

  it("says the value, the return and the profit of each, and how far the scenario moves the value", () => {
    renderSection();

    const base = within(card("Base"));
    expect(base.getByText("$125,430.00")).toBeInTheDocument();
    expect(base.getByText("+6.12%")).toBeInTheDocument();
    expect(base.getByText("+$25,430.00")).toBeInTheDocument();

    const apple = within(card("Apple falls"));
    expect(apple.getByText("$121,416.00")).toBeInTheDocument();
    expect(apple.getByText("+2.90%")).toBeInTheDocument();
    expect(apple.getByText("-3.20%")).toBeInTheDocument();
  });

  it("names the main variable of the scenario under its name, and says when there is none", () => {
    renderSection();

    expect(within(card("Apple falls")).getByText("AAPL price -10 %")).toBeInTheDocument();
    expect(within(card("Microsoft rallies")).getByText("No changes")).toBeInTheDocument();
  });

  it("puts the figures side by side in a table: the base and a column for each letter", () => {
    renderSection();

    const table = within(screen.getByRole("table", { name: "Differences" }));
    expect(table.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Figure",
      "Base",
      "A",
      "B",
    ]);
    const value = within(table.getByRole("row", { name: /^Value/ }));
    expect(value.getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "$125,430.00",
      "$121,416.00-3.20%",
      "$127,186.00+1.40%",
    ]);
    const returns = within(table.getByRole("row", { name: /^Return/ }));
    expect(returns.getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "+6.12%",
      "+2.90%",
      "+7.55%",
    ]);
  });

  it("adds the weight of each asset in every column with how far it shifts, and names the one it does not know", () => {
    renderSection();

    const table = within(screen.getByRole("table", { name: "Differences" }));
    const aapl = within(table.getByRole("row", { name: /^Weight of AAPL/ }));
    expect(aapl.getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "32.0%",
      "29.8%-2.20 pp",
      "31.6%-0.40 pp",
    ]);
    expect(table.getByRole("row", { name: /^Weight of an unknown asset/ })).toBeInTheDocument();
    const profit = within(table.getByRole("row", { name: /^Profit/ }));
    expect(profit.getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "+$25,430.00",
      "+$21,416.00",
      "+$27,186.00",
    ]);
  });

  it("says which scenario has changes on assets the portfolio does not hold", () => {
    renderSection();

    expect(
      screen.getByText(
        "“Microsoft rallies” has changes on assets the portfolio does not hold; they are left out.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/are left out/)).toHaveLength(1);
  });

  it("holds the place of the figures while the comparison is on its way", () => {
    renderSection({ comparison: undefined });

    expect(screen.getByRole("status", { name: "Comparing the scenarios" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says it could not compare and asks again on retry", async () => {
    const { onRetry } = renderSection({ comparison: undefined, isError: true });

    expect(screen.getByRole("alert")).toHaveTextContent("Could not compare the scenarios");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    const { view } = renderSection();

    expect(await axe(view.container)).toHaveNoViolations();
  });
});
