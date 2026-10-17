import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type { Position, Transaction } from "@trading/domain";
import {
  createTransactionResponseSchema,
  presentCreateTransactionResult,
  presentTransaction,
  transactionResponseSchema,
} from "./transaction.response.js";

const transaction: Transaction = {
  id: "t1",
  portfolioId: "p1",
  assetId: "a1",
  type: "BUY",
  quantity: 2,
  price: Money.of("100.25", "USD"),
  fees: Money.of("1", "USD"),
  status: "COMPLETED",
  executedAt: new Date("2026-10-13T12:00:00.000Z"),
  createdAt: new Date("2026-10-13T12:00:01.000Z"),
};

const position: Position = {
  id: "pos1",
  portfolioId: "p1",
  assetId: "a1",
  quantity: 2,
  averageEntryPrice: Money.of("100.25", "USD"),
  currentPrice: Money.of("101", "USD"),
  openedAt: new Date("2026-10-13T12:00:00.000Z"),
  updatedAt: new Date("2026-10-13T12:00:01.000Z"),
};

/** What the value looks like after a trip through JSON. */
function json(value: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

describe("transaction presenters", () => {
  it("serializes a transaction exactly as before, plus its realized P/L", () => {
    const dto = presentTransaction(transaction, null);
    expect(dto).toEqual({ ...json(transaction), realizedPnL: null });
    expect(dto.price).toEqual({ amount: "100.25", currency: "USD" });
    expect(transactionResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("presents the realized P/L of a SELL as money and leaves a BUY at null", () => {
    const sell: Transaction = { ...transaction, id: "t2", type: "SELL" };

    expect(presentTransaction(sell, Money.of("-15.5", "USD")).realizedPnL).toEqual({
      amount: "-15.5",
      currency: "USD",
    });
    expect(presentTransaction(transaction, null).realizedPnL).toBeNull();
  });

  it("serializes the create result with and without a resulting position", () => {
    for (const result of [
      { transaction, position, realizedPnL: null },
      { transaction, position: null, realizedPnL: null },
    ]) {
      const dto = presentCreateTransactionResult(result);
      expect(dto).toEqual({
        transaction: { ...json(transaction), realizedPnL: null },
        position: result.position ? json(result.position) : null,
      });
      expect(createTransactionResponseSchema.safeParse(dto).success).toBe(true);
    }
  });

  it("does not leak fields outside the contract", () => {
    expect(
      Object.keys(presentTransaction({ ...transaction, extra: 1 } as Transaction, null)).sort(),
    ).toEqual(
      [
        "assetId",
        "createdAt",
        "executedAt",
        "fees",
        "id",
        "portfolioId",
        "price",
        "quantity",
        "realizedPnL",
        "status",
        "type",
      ].sort(),
    );
  });
});
