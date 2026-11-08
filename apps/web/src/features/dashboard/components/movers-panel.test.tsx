import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { MoversPanel } from "./movers-panel";

describe("MoversPanel", () => {
  it("lists each position with its signed percentage, biggest move first", () => {
    render(
      <MoversPanel
        movers={[
          { symbol: "NVDA", percent: 3.8 },
          { symbol: "JNJ", percent: -1.4 },
        ]}
      />,
    );

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["NVDA▲ +3.80%", "JNJ▼ -1.40%"]);
  });

  it("names the panel and what it measures", () => {
    render(<MoversPanel movers={[{ symbol: "NVDA", percent: 3.8 }]} />);

    expect(screen.getByRole("heading", { name: "Top movers" })).toBeInTheDocument();
    expect(screen.getByText("Change today by position")).toBeInTheDocument();
  });

  it("says so when no position has moved yet", () => {
    render(<MoversPanel movers={[]} />);

    expect(screen.getByText("No movement yet today")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
