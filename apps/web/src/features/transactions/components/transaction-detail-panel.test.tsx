import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { TransactionRow } from "../types";
import { TransactionDetailPanel } from "./transaction-detail-panel";

const row: TransactionRow = {
  id: "t1",
  executedAt: "2026-10-06T14:29:00.000Z",
  type: "BUY",
  symbol: "AAPL",
  name: "Apple Inc.",
  quantity: 10,
  price: { amount: "180.20", currency: "USD" },
  fees: { amount: "1.00", currency: "USD" },
  total: { amount: "1802.00", currency: "USD" },
  status: "PROCESSING",
};

function renderPanel(transaction: TransactionRow | null, onClose = vi.fn()) {
  render(<TransactionDetailPanel onClose={onClose} transaction={transaction} />);
  return onClose;
}

const valueOf = (label: string) => {
  const term = screen.getByText(label, { selector: "dt" });
  return term.closest("div")?.querySelector("dd");
};

describe("TransactionDetailPanel", () => {
  it("shows nothing while no transaction is chosen", () => {
    renderPanel(null);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("titles the panel and says when the transaction was made", () => {
    renderPanel(row);

    const dialog = screen.getByRole("dialog", { name: "Transaction details" });
    expect(within(dialog).getByText(/2026/)).toBeInTheDocument();
  });

  it("lists the type, the asset, the quantity, the price and the operation", () => {
    renderPanel(row);

    expect(valueOf("Type")).toHaveTextContent("Buy");
    expect(valueOf("Asset")).toHaveTextContent("AAPL · Apple Inc.");
    expect(valueOf("Quantity")).toHaveTextContent("10 units");
    expect(valueOf("Price per unit")).toHaveTextContent("$180.20");
    expect(valueOf("Operation")).toHaveTextContent("$1,802.00");
  });

  it("lists the fees, the total with the fees and the status", () => {
    renderPanel(row);

    expect(valueOf("Fees")).toHaveTextContent("$1.00");
    expect(valueOf("Total")).toHaveTextContent("$1,803.00");
    expect(valueOf("Status")).toHaveTextContent("Pending");
  });

  it("takes the fees off the total of a sale", () => {
    renderPanel({ ...row, type: "SELL" });

    expect(valueOf("Total")).toHaveTextContent("$1,801.00");
  });

  it("names an asset the list could not resolve", () => {
    renderPanel({ ...row, symbol: null, name: null });

    expect(valueOf("Asset")).toHaveTextContent("Unknown asset");
  });

  it("closes from the Close button", async () => {
    const onClose = renderPanel(row);

    // The header has its X and the footer has the Figma "Cerrar"; both close.
    const buttons = screen.getAllByRole("button", { name: "Close" });
    expect(buttons).toHaveLength(2);
    const footer = buttons.at(-1);
    if (!footer) throw new Error("the footer should have a Close button");
    await userEvent.click(footer);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
