import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { TransactionRow } from "../types";
import { TransactionRowMenu } from "./transaction-row-menu";

const transaction: TransactionRow = {
  id: "t1",
  executedAt: "2026-10-06T14:29:00.000Z",
  type: "BUY",
  symbol: "AAPL",
  name: "Apple Inc.",
  quantity: 10,
  price: { amount: "180.20", currency: "USD" },
  fees: { amount: "1.00", currency: "USD" },
  total: { amount: "1802.00", currency: "USD" },
  status: "COMPLETED",
};

describe("TransactionRowMenu", () => {
  it("names its button after the transaction it belongs to", () => {
    render(<TransactionRowMenu onView={vi.fn()} transaction={transaction} />);

    expect(
      screen.getByRole("button", { name: "Actions for the Apple Inc. transaction" }),
    ).toBeInTheDocument();
  });

  it("offers only 'View details', because the API cannot delete", async () => {
    render(<TransactionRowMenu onView={vi.fn()} transaction={transaction} />);

    await userEvent.click(screen.getByRole("button", { name: /Actions for/ }));

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "View details",
    ]);
  });

  it("hands over the transaction when 'View details' is chosen", async () => {
    const onView = vi.fn();
    render(<TransactionRowMenu onView={onView} transaction={transaction} />);

    await userEvent.click(screen.getByRole("button", { name: /Actions for/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "View details" }));

    expect(onView).toHaveBeenCalledExactlyOnceWith(transaction);
  });

  it("names a transaction whose asset did not load", () => {
    render(
      <TransactionRowMenu
        onView={vi.fn()}
        transaction={{ ...transaction, name: null, symbol: null }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Actions for the Unknown asset transaction" }),
    ).toBeInTheDocument();
  });
});
