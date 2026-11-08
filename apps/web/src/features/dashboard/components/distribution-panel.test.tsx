import type { AllocationResponse } from "@trading/contracts";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { DistributionPanel } from "./distribution-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

function group(key: string, amount: string, percentage: number) {
  return { key, label: key, marketValue: usd(amount), percentage };
}

function allocation(groups: AllocationResponse["groups"]): AllocationResponse {
  return { groupBy: "asset", groups };
}

describe("DistributionPanel", () => {
  it("names the panel and says how much is invested", () => {
    render(
      <DistributionPanel
        allocation={allocation([group("AAPL", "42646.00", 34)])}
        investedValue={usd("125430.00")}
      />,
    );

    expect(screen.getByRole("heading", { name: "Distribution" })).toBeInTheDocument();
    expect(screen.getByText("Weight by asset · $125,430.00 invested")).toBeInTheDocument();
  });

  it("lists each asset with its value and percentage, the largest first", () => {
    render(
      <DistributionPanel
        allocation={allocation([group("MSFT", "27595.00", 22), group("AAPL", "42646.00", 34)])}
        investedValue={usd("70241.00")}
      />,
    );

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "AAPL$42,646.0034%",
      "MSFT$27,595.0022%",
    ]);
  });

  it("groups what is beyond the four largest assets as Others", () => {
    render(
      <DistributionPanel
        allocation={allocation([
          group("A", "40.00", 40),
          group("B", "20.00", 20),
          group("C", "15.00", 15),
          group("D", "10.00", 10),
          group("E", "10.00", 10),
          group("F", "5.00", 5),
        ])}
        investedValue={usd("100.00")}
      />,
    );

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[4]).toHaveTextContent("Others$15.0015%");
  });

  it("says so when there is nothing to distribute", () => {
    render(<DistributionPanel allocation={allocation([])} investedValue={usd("0.00")} />);

    expect(screen.getByText("Nothing to distribute yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
