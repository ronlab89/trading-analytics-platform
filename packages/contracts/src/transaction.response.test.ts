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

describe("transaction presenters", () => {
  it("serializes a transaction exactly as before", () => {
    const dto = presentTransaction(transaction);
    expect(dto).toEqual(JSON.parse(JSON.stringify(transaction)));
    expect(dto.price).toEqual({ amount: "100.25", currency: "USD" });
    expect(transactionResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("serializes the create result with and without a resulting position", () => {
    for (const result of [
      { transaction, position },
      { transaction, position: null },
    ]) {
      const dto = presentCreateTransactionResult(result);
      expect(dto).toEqual(JSON.parse(JSON.stringify(result)));
      expect(createTransactionResponseSchema.safeParse(dto).success).toBe(true);
    }
  });

  it("does not leak fields outside the contract", () => {
    expect(
      Object.keys(presentTransaction({ ...transaction, extra: 1 } as Transaction)).sort(),
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
        "status",
        "type",
      ].sort(),
    );
  });
});
