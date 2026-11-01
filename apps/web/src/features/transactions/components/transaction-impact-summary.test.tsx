import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { transactionImpact } from "../lib/transaction-impact";
import { TransactionImpactSummary } from "./transaction-impact-summary";

const input = {
  type: "BUY",
  quantity: "10",
  price: "180.20",
  fees: "1.00",
  currency: "USD",
  held: 236 as number | undefined,
};

function renderSummary(patch: Partial<typeof input> = {}) {
  const impact = transactionImpact({ ...input, ...patch });
  if (!impact) throw new Error("the input should give an impact");
  render(<TransactionImpactSummary impact={impact} symbol="AAPL" />);
}

const row = (label: string) => screen.getByText(label).closest("div");

describe("TransactionImpactSummary", () => {
  it("shows the operation, the fees, the total and the position of the Figma example", () => {
    renderSummary();

    expect(screen.getByRole("region", { name: "Impact summary" })).toBeInTheDocument();
    expect(row("Operation (10 × $180.20)")).toHaveTextContent("$1,802.00");
    expect(row("Fees")).toHaveTextContent("$1.00");
    expect(row("Total")).toHaveTextContent("$1,803.00");
    expect(row("Position in AAPL")).toHaveTextContent("236 to 246");
  });

  it("shows the position going down on a sale", () => {
    renderSummary({ type: "SELL" });

    expect(row("Total")).toHaveTextContent("$1,801.00");
    expect(row("Position in AAPL")).toHaveTextContent("236 to 226");
  });

  it("leaves the position out while it is not known", () => {
    renderSummary({ held: undefined });

    expect(screen.queryByText("Position in AAPL")).not.toBeInTheDocument();
    expect(row("Total")).toHaveTextContent("$1,803.00");
  });

  it("does not show the cash line, which the API cannot give", () => {
    renderSummary();

    expect(screen.queryByText(/cash|efectivo/i)).not.toBeInTheDocument();
  });
});
