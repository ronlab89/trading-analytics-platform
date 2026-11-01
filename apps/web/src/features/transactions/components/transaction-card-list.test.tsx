import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import type { TransactionRow } from "../types";
import { TransactionCardList } from "./transaction-card-list";

function row(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: "t1",
    executedAt: "2026-10-31T14:05:00.000Z",
    type: "BUY",
    symbol: "AAPL",
    name: "Apple Inc.",
    quantity: 10,
    price: { amount: "180.20", currency: "USD" },
    fees: { amount: "1.00", currency: "USD" },
    total: { amount: "1802.00", currency: "USD" },
    status: "COMPLETED",
    ...overrides,
  };
}

describe("TransactionCardList", () => {
  it("draws one card per transaction, in the order it gets them", () => {
    render(
      <TransactionCardList
        rows={[
          row({ id: "b", name: "Bitcoin", symbol: "BTC" }),
          row({ id: "a", name: "Apple Inc." }),
        ]}
      />,
    );

    const cards = within(screen.getByRole("list", { name: "Transactions" })).getAllByRole(
      "listitem",
    );

    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Bitcoin");
    expect(cards[1]).toHaveTextContent("Apple Inc.");
  });

  it("writes the asset, the type, the total and the status of a transaction", () => {
    render(<TransactionCardList rows={[row()]} />);

    const card = screen.getByRole("listitem");
    expect(within(card).getByText("Apple Inc.")).toBeInTheDocument();
    expect(within(card).getByText("Buy")).toBeInTheDocument();
    expect(within(card).getByText("$1,802.00")).toBeInTheDocument();
    expect(within(card).getByText("Settled")).toBeInTheDocument();
  });

  it("writes a sale as a sale", () => {
    render(<TransactionCardList rows={[row({ type: "SELL" })]} />);

    expect(screen.getByText("Sell")).toBeInTheDocument();
  });

  it("leaves out the quantity, the price and the fees, as the Figma does", () => {
    render(<TransactionCardList rows={[row()]} />);

    const card = screen.getByRole("listitem");
    expect(within(card).queryByText(/\$180\.20/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/\$1\.00/)).not.toBeInTheDocument();
    expect(within(card).queryByText("10")).not.toBeInTheDocument();
  });

  it("marks the date as a time element with the instant the API sent", () => {
    render(<TransactionCardList rows={[row()]} />);

    expect(screen.getByRole("listitem").querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-10-31T14:05:00.000Z",
    );
  });

  it("names an asset that did not load", () => {
    render(<TransactionCardList rows={[row({ name: null, symbol: null })]} />);

    expect(screen.getByText("Unknown asset")).toBeInTheDocument();
  });
});
