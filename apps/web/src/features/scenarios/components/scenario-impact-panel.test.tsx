import type { ScenarioCalculationResponse } from "@trading/contracts";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ScenarioImpactPanel } from "./scenario-impact-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

const calculation: ScenarioCalculationResponse = {
  scenarioId: "s1",
  baseline: {
    totalValue: usd("125430.00"),
    investedValue: usd("118200.00"),
    unrealizedPnL: usd("7230.00"),
    unrealizedPnLPercent: 6.12,
  },
  result: {
    totalValue: usd("121416.00"),
    investedValue: usd("118200.00"),
    unrealizedPnL: usd("3216.00"),
    unrealizedPnLPercent: 2.72,
  },
  difference: { totalValue: usd("-4014.00"), unrealizedPnL: usd("-4014.00") },
  unmatchedAssetIds: [],
};

function renderPanel(overrides: Partial<Parameters<typeof ScenarioImpactPanel>[0]> = {}) {
  const onRetry = vi.fn();
  const view = render(
    <ScenarioImpactPanel
      calculation={calculation}
      failed={false}
      onRetry={onRetry}
      recalculating={false}
      {...overrides}
    />,
  );
  return { onRetry, view };
}

const figure = (label: string) => screen.getByRole("group", { name: label });

describe("ScenarioImpactPanel", () => {
  it("says what it shows and that it is recalculated when a control moves", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Scenario impact" })).toBeInTheDocument();
    expect(
      screen.getByText("Against the base · recalculated when you move a control"),
    ).toBeInTheDocument();
  });

  it("puts the value of the portfolio today next to the value with the scenario and how far it moves", () => {
    renderPanel();

    const value = within(figure("Portfolio value"));
    expect(value.getByText("$125,430.00")).toBeInTheDocument();
    expect(value.getByText("$121,416.00")).toBeInTheDocument();
    expect(value.getByText("-3.20%")).toBeInTheDocument();
  });

  it("does the same for the return: the base, the scenario and the points between them", () => {
    renderPanel();

    const result = within(figure("Return"));
    expect(result.getByText("+6.12%")).toBeInTheDocument();
    expect(result.getByText("+2.72%")).toBeInTheDocument();
    expect(result.getByText("-3.40%")).toBeInTheDocument();
  });

  it("always says that the scenario does not touch the real portfolio", () => {
    renderPanel();

    expect(screen.getByText("Isolated scenario")).toBeInTheDocument();
    expect(
      screen.getByText("The changes do not modify your transactions or your real portfolio."),
    ).toBeInTheDocument();
  });

  it("holds the place of the figures while the first calculation is on its way", () => {
    renderPanel({ calculation: undefined });

    expect(screen.getByRole("status", { name: "Calculating the scenario" })).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("keeps the last figures while it recalculates and says so", () => {
    renderPanel({ recalculating: true });

    expect(screen.getByText("Recalculating…")).toBeInTheDocument();
    expect(within(figure("Portfolio value")).getByText("$121,416.00")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Scenario impact" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("does not say it recalculates when it does not", () => {
    renderPanel();

    expect(screen.queryByText("Recalculating…")).not.toBeInTheDocument();
  });

  it("says it could not calculate, without figures that may be old, and asks again on retry", async () => {
    const { onRetry } = renderPanel({ failed: true });

    expect(screen.getByRole("alert")).toHaveTextContent("Could not calculate the scenario");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByText("Isolated scenario")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    const { view } = renderPanel();

    expect(await axe(view.container)).toHaveNoViolations();
  });
});
