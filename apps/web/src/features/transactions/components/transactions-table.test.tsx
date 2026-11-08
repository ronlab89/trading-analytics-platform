import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { TransactionRow } from "../types";
import { TransactionsTable } from "./transactions-table";

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

describe("TransactionsTable", () => {
  it("draws the eight columns of the Figma", () => {
    render(<TransactionsTable onView={vi.fn()} rows={[row()]} />);

    const headers = within(screen.getByRole("table", { name: "Transactions" }))
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Date",
      "Type",
      "Asset",
      "Quantity",
      "Price",
      "Fees",
      "Total",
      "Status",
      // The Figma header of the menu column is blank; only screen readers get a name for it.
      "Actions",
    ]);
  });

  it("gives every row a menu that opens that transaction", async () => {
    const onView = vi.fn();
    const other = row({ id: "t2", name: "Bitcoin", symbol: "BTC" });
    render(<TransactionsTable onView={onView} rows={[row(), other]} />);

    await userEvent.click(screen.getByRole("button", { name: /Actions for the Bitcoin/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "View details" }));

    expect(onView).toHaveBeenCalledExactlyOnceWith(other);
  });

  it("writes the money, the quantity, the type and the status of a transaction", () => {
    render(<TransactionsTable onView={vi.fn()} rows={[row()]} />);

    const line = screen.getByRole("row", { name: /Apple Inc\./ });
    expect(within(line).getByText("Apple Inc.")).toBeInTheDocument();
    expect(within(line).getByText("Buy")).toBeInTheDocument();
    expect(within(line).getByText("10")).toBeInTheDocument();
    expect(within(line).getByText("$180.20")).toBeInTheDocument();
    expect(within(line).getByText("$1.00")).toBeInTheDocument();
    expect(within(line).getByText("$1,802.00")).toBeInTheDocument();
    expect(within(line).getByText("Settled")).toBeInTheDocument();
  });

  it("keeps the order of the rows it is given", () => {
    render(
      <TransactionsTable
        onView={vi.fn()}
        rows={[
          row({ id: "b", name: "Bitcoin", symbol: "BTC" }),
          row({ id: "a", name: "Apple Inc." }),
        ]}
      />,
    );

    const names = screen.getAllByRole("rowheader").map((header) => header.textContent);

    expect(names).toEqual(["BTCBitcoin", "AAPLApple Inc."]);
  });

  it("shows a sale and a pending transaction in their own words", () => {
    render(
      <TransactionsTable onView={vi.fn()} rows={[row({ type: "SELL", status: "PROCESSING" })]} />,
    );

    expect(screen.getByText("Sell")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("names an asset that did not load", () => {
    render(<TransactionsTable onView={vi.fn()} rows={[row({ name: null, symbol: null })]} />);

    expect(screen.getByText("Unknown asset")).toBeInTheDocument();
  });
});
