import type { TransactionResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { toTransactionRow } from "./transaction-row";

const transaction: TransactionResponse = {
  id: "t1",
  portfolioId: "p1",
  assetId: "a1",
  type: "BUY",
  quantity: 10,
  price: { amount: "180.20", currency: "USD" },
  fees: { amount: "1.00", currency: "USD" },
  realizedPnL: null,
  status: "COMPLETED",
  executedAt: "2026-10-06T14:29:00.000Z",
  createdAt: "2026-10-06T14:29:00.000Z",
};

describe("toTransactionRow", () => {
  it("takes the asset's symbol and name and works the total out from the price and the quantity", () => {
    expect(toTransactionRow(transaction, { symbol: "AAPL", name: "Apple Inc." })).toEqual({
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
    });
  });

  it("leaves the symbol and the name null when the asset is not known", () => {
    const row = toTransactionRow(transaction, undefined);

    expect(row.symbol).toBeNull();
    expect(row.name).toBeNull();
    expect(row.total).toEqual({ amount: "1802.00", currency: "USD" });
  });
});
