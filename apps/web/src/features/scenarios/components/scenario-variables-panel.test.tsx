import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import type { ScenarioVariable } from "../lib/scenario-variables";
import { ScenarioVariablesPanel } from "./scenario-variables-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

const variables: ScenarioVariable[] = [
  { assetId: "a1", symbol: "AAPL", price: usd("180.70"), percent: -10 },
  { assetId: "a2", symbol: "MSFT", price: usd("410.20"), percent: 5 },
  { assetId: "a3", symbol: "KO", price: usd("62.10"), percent: 0 },
];

function renderPanel(overrides: Partial<Parameters<typeof ScenarioVariablesPanel>[0]> = {}) {
  const onChange = vi.fn();
  const view = render(
    <ScenarioVariablesPanel onChange={onChange} unsaved variables={variables} {...overrides} />,
  );
  return { onChange, view };
}

const control = (name: string) => screen.getByRole("group", { name });

describe("ScenarioVariablesPanel", () => {
  it("has a titled control for each asset, with its price today", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Variables" })).toBeInTheDocument();
    expect(screen.getByText("Move each control to change the scenario")).toBeInTheDocument();
    expect(within(control("AAPL price")).getByText("$180.70")).toBeInTheDocument();
    expect(within(control("MSFT price")).getByText("$410.20")).toBeInTheDocument();
    expect(screen.getAllByRole("slider")).toHaveLength(3);
  });

  it("says how far each price moves: red down, green up, Base when it does not", () => {
    renderPanel();

    // The badge and the label of the step the slider is on both say it.
    expect(within(control("AAPL price")).getAllByText("-10 %")).toHaveLength(2);
    expect(within(control("MSFT price")).getAllByText("+5 %")).toHaveLength(2);
    expect(within(control("KO price")).getAllByText("Base")).toHaveLength(2);
    expect(
      within(control("AAPL price")).getByText("-10 %", { selector: "span.rounded-md" }),
    ).toBeInTheDocument();
  });

  it("puts each slider at its value, with the name of the asset", () => {
    renderPanel();

    expect(screen.getByRole("slider", { name: "AAPL price" })).toHaveAttribute(
      "aria-valuenow",
      "-10",
    );
    expect(screen.getByRole("slider", { name: "MSFT price" })).toHaveAttribute(
      "aria-valuenow",
      "5",
    );
    expect(screen.getByRole("slider", { name: "KO price" })).toHaveAttribute("aria-valuenow", "0");
  });

  it("highlights the step the slider is on and writes the five steps under it", () => {
    renderPanel();

    const aapl = within(control("AAPL price"));
    expect(
      ["-10 %", "-5 %", "Base", "+5 %", "+10 %"].map((label) => aapl.getAllByText(label).length),
    ).toEqual([2, 1, 1, 1, 1]);
    expect(aapl.getByTestId("step--10")).toHaveClass("font-semibold");
    expect(aapl.getByTestId("step-0")).not.toHaveClass("font-semibold");
  });

  it("tells which asset and how much when a slider moves", async () => {
    const { onChange } = renderPanel();

    screen.getByRole("slider", { name: "KO price" }).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith("a3", 1);
  });

  it("puts one price back on Base with its own reset, which a price on Base does not have", async () => {
    const { onChange } = renderPanel();

    await userEvent.click(
      within(control("AAPL price")).getByRole("button", { name: "Reset AAPL price" }),
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith("a1", 0);
    expect(within(control("KO price")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("says that the scenario is not saved yet, only when it is not", () => {
    const { view } = renderPanel();
    expect(screen.getByText("Unsaved")).toBeInTheDocument();

    view.rerender(
      <ScenarioVariablesPanel onChange={vi.fn()} unsaved={false} variables={variables} />,
    );
    expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();
  });

  it("names the asset it does not know and has no price for one the portfolio no longer holds", () => {
    renderPanel({
      variables: [{ assetId: "a9", symbol: null, price: null, percent: 4 }],
    });

    const unknown = within(control("Asset price"));
    expect(unknown.getByText("+4 %")).toBeInTheDocument();
    expect(unknown.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("says there is nothing to move when the portfolio holds no assets", () => {
    renderPanel({ variables: [] });

    expect(screen.getByText("No assets to change")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("has no reset of its own unless it is given one, and then it takes everything back", async () => {
    const { view } = renderPanel();
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();

    const onReset = vi.fn();
    view.rerender(
      <ScenarioVariablesPanel onChange={vi.fn()} onReset={onReset} unsaved variables={variables} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(onReset).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    const { view } = renderPanel();

    expect(await axe(view.container)).toHaveNoViolations();
  });
});
