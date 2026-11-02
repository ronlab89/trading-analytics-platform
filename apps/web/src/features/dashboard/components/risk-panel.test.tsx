import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { RiskPanel } from "./risk-panel";

describe("RiskPanel", () => {
  it("names the panel and writes the level and the volatility", () => {
    render(<RiskPanel volatility={{ classification: "MODERATE", value: 14.23 }} />);

    expect(screen.getByRole("region", { name: "Risk level" })).toBeInTheDocument();
    expect(screen.getByText("Moderate")).toBeInTheDocument();
    expect(screen.getByText("Annualized volatility 14.2%")).toBeInTheDocument();
  });

  it("flags a moderate or high level with the alert badge", () => {
    const { rerender } = render(
      <RiskPanel volatility={{ classification: "MODERATE", value: 14 }} />,
    );
    expect(screen.getByText("Alert")).toBeInTheDocument();

    rerender(<RiskPanel volatility={{ classification: "HIGH", value: 40 }} />);
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("has no alert badge on a low level", () => {
    render(<RiskPanel volatility={{ classification: "LOW", value: 5 }} />);

    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.queryByText("Alert")).not.toBeInTheDocument();
  });

  it("says there is no data yet, with no needle and no alert, when the volatility is unknown", () => {
    const { container } = render(
      <RiskPanel volatility={{ classification: "UNKNOWN", value: null }} />,
    );

    expect(screen.getByText("No data yet")).toBeInTheDocument();
    expect(screen.getByText("Volatility needs more days of history")).toBeInTheDocument();
    expect(screen.queryByText("Alert")).not.toBeInTheDocument();
    expect(container.querySelector("line")).toBeNull();
  });

  it("draws the needle on the active step", () => {
    const { container } = render(<RiskPanel volatility={{ classification: "HIGH", value: 40 }} />);

    expect(container.querySelectorAll('svg[viewBox="0 0 200 112"] path')).toHaveLength(3);
    expect(container.querySelector("line")).not.toBeNull();
  });
});
