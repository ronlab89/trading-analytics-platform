import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { TransactionRow } from "@/features/transactions/types";
import { RecentTransactionsPanel } from "./recent-transactions-panel";

function row(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
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
    ...overrides,
  };
}

function stubMobile(isMobile: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: isMobile,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderPanel(rows: readonly TransactionRow[], onNew = vi.fn()) {
  render(
    <MemoryRouter>
      <RecentTransactionsPanel onNew={onNew} rows={rows} />
    </MemoryRouter>,
  );
  return onNew;
}

// Not `unstubAllGlobals`: that would also drop the ResizeObserver stub `setup.ts` installs once.
afterEach(() => {
  vi.stubGlobal("matchMedia", undefined);
});

describe("RecentTransactionsPanel", () => {
  it("is a region named after what it lists, with how many it shows", () => {
    renderPanel([row(), row({ id: "t2" })]);

    expect(screen.getByRole("region", { name: "Recent transactions" })).toBeInTheDocument();
    expect(screen.getByText("Last 2")).toBeInTheDocument();
  });

  it("links to the whole history", () => {
    renderPanel([row()]);

    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/transactions");
  });

  it("draws one table row per transaction with its asset, type, quantity at price, amount and status", () => {
    renderPanel([row(), row({ id: "t2", type: "SELL", name: "Microsoft", symbol: "MSFT" })]);

    const table = screen.getByRole("table", { name: "Recent transactions" });
    const first = within(table).getByRole("row", { name: /Apple Inc\./ });
    expect(within(first).getByText("Buy")).toBeInTheDocument();
    expect(within(first).getByText("10 × $180.20")).toBeInTheDocument();
    expect(within(first).getByText("$1,802.00")).toBeInTheDocument();
    expect(within(first).getByText("Settled")).toBeInTheDocument();
    expect(within(table).getByText("Sell")).toBeInTheDocument();
  });

  it("keeps the order of the rows it is given", () => {
    renderPanel([row({ id: "b", name: "Bitcoin", symbol: "BTC" }), row({ id: "a" })]);

    const names = screen.getAllByRole("rowheader").map((header) => header.textContent);

    expect(names).toEqual(["BTCBitcoin", "AAPLApple Inc."]);
  });

  it("names an asset that did not load", () => {
    renderPanel([row({ name: null, symbol: null })]);

    expect(screen.getByText("Unknown asset")).toBeInTheDocument();
  });

  it("says there are no transactions and offers the first one", async () => {
    const onNew = renderPanel([]);

    expect(screen.getByText("No transactions")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "New transaction" }));

    expect(onNew).toHaveBeenCalledOnce();
  });

  it("is a list of cards on a phone, and tapping one opens its detail", async () => {
    stubMobile(true);
    renderPanel([row()]);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View the Apple Inc. transaction" }));

    expect(await screen.findByRole("dialog", { name: "Transaction details" })).toBeInTheDocument();
  });
});
