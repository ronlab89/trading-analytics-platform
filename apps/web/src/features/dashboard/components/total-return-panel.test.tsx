import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { TotalReturnPanel } from "./total-return-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

function renderPanel(props: Partial<Parameters<typeof TotalReturnPanel>[0]> = {}) {
  return render(
    <TotalReturnPanel empty={false} percent={17} profit={usd("18200.00")} {...props} />,
  );
}

describe("TotalReturnPanel", () => {
  it("is a region named after the return", () => {
    renderPanel();

    expect(screen.getByRole("region", { name: "Total return" })).toBeInTheDocument();
  });

  it("shows the gain in money and in percent", () => {
    renderPanel();

    expect(screen.getByText("+$18,200.00")).toBeInTheDocument();
    expect(screen.getByText("+17.00% gain")).toBeInTheDocument();
  });

  it("says what the figure measures, since it leaves out what was already sold", () => {
    renderPanel();

    expect(screen.getByText("Unrealized result of your open positions")).toBeInTheDocument();
  });

  it("writes a loss with a minus and calls it a loss", () => {
    renderPanel({ percent: -3.25, profit: usd("-4100.50") });

    expect(screen.getByText("-$4,100.50")).toBeInTheDocument();
    expect(screen.getByText("-3.25% loss")).toBeInTheDocument();
  });

  it("writes no change as zero", () => {
    renderPanel({ percent: 0, profit: usd("0.00") });

    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.getByText("0.00% no change")).toBeInTheDocument();
  });

  it("says there is no return yet while the portfolio is empty", () => {
    renderPanel({ empty: true });

    expect(screen.getByText("No gains yet")).toBeInTheDocument();
    expect(
      screen.getByText("The total return is worked out from your positions."),
    ).toBeInTheDocument();
    expect(screen.queryByText("+$18,200.00")).not.toBeInTheDocument();
  });
});
