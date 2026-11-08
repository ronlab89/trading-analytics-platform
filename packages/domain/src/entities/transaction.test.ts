import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money.js";
import { TransactionType } from "./enums.js";
import { InvalidTransactionError, validateNewTransaction } from "./transaction.js";

const now = new Date("2026-06-15T12:00:00Z");

const baseInput = {
  portfolioId: "portfolio_001",
  assetId: "asset_001",
  type: TransactionType.BUY,
  quantity: 10,
  price: Money.of(150, "USD"),
};

describe("validateNewTransaction", () => {
  it("should accept a valid transaction input", () => {
    expect(() => {
      validateNewTransaction(baseInput, now);
    }).not.toThrow();
  });

  it("should reject a missing portfolioId", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, portfolioId: "" }, now);
    }).toThrow(InvalidTransactionError);
  });

  it("should reject a missing assetId", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, assetId: "" }, now);
    }).toThrow(InvalidTransactionError);
  });

  it("should reject an unsupported transaction type", () => {
    expect(() => {
      validateNewTransaction(
        {
          ...baseInput,
          // @ts-expect-error intentionally invalid for the test
          type: "DIVIDEND",
        },
        now,
      );
    }).toThrow(InvalidTransactionError);
  });

  it("should reject a zero quantity", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, quantity: 0 }, now);
    }).toThrow(InvalidTransactionError);
  });

  it("should reject a negative quantity", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, quantity: -5 }, now);
    }).toThrow(InvalidTransactionError);
  });

  it("should reject a zero price", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, price: Money.zero("USD") }, now);
    }).toThrow(InvalidTransactionError);
  });

  it("should reject negative fees", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, fees: Money.of(-1, "USD") }, now);
    }).toThrow(InvalidTransactionError);
  });

  it("should accept zero fees", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, fees: Money.zero("USD") }, now);
    }).not.toThrow();
  });

  it("should reject fees in a different currency than price", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, fees: Money.of(1, "EUR") }, now);
    }).toThrow(InvalidTransactionError);
  });

  it("should reject a SELL whose fees exceed its gross proceeds", () => {
    expect(() => {
      validateNewTransaction(
        { ...baseInput, type: TransactionType.SELL, fees: Money.of("1500.01", "USD") },
        now,
      );
    }).toThrow(InvalidTransactionError);
  });

  it("should accept a SELL whose fees equal its gross proceeds", () => {
    expect(() => {
      validateNewTransaction(
        { ...baseInput, type: TransactionType.SELL, fees: Money.of(1500, "USD") },
        now,
      );
    }).not.toThrow();
  });

  it("should accept a BUY whose fees exceed quantity times price", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, fees: Money.of(2000, "USD") }, now);
    }).not.toThrow();
  });

  it("should reject an execution date after the given now", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, executedAt: new Date("2026-07-01T00:00:00Z") }, now);
    }).toThrow(InvalidTransactionError);
  });

  it("should accept an execution date before the given now", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, executedAt: new Date("2026-06-14T00:00:00Z") }, now);
    }).not.toThrow();
  });

  it("should accept an execution date equal to the given now", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, executedAt: new Date(now) }, now);
    }).not.toThrow();
  });
});
