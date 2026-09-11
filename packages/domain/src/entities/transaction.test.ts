import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import { TransactionType } from "./enums";
import { InvalidTransactionError, validateNewTransaction } from "./transaction";

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
      validateNewTransaction(baseInput);
    }).not.toThrow();
  });

  it("should reject a missing portfolioId", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, portfolioId: "" });
    }).toThrow(InvalidTransactionError);
  });

  it("should reject a missing assetId", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, assetId: "" });
    }).toThrow(InvalidTransactionError);
  });

  it("should reject an unsupported transaction type", () => {
    expect(() => {
      validateNewTransaction({
        ...baseInput,
        // @ts-expect-error intentionally invalid for the test
        type: "DIVIDEND",
      });
    }).toThrow(InvalidTransactionError);
  });

  it("should reject a zero quantity", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, quantity: 0 });
    }).toThrow(InvalidTransactionError);
  });

  it("should reject a negative quantity", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, quantity: -5 });
    }).toThrow(InvalidTransactionError);
  });

  it("should reject a zero price", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, price: Money.zero("USD") });
    }).toThrow(InvalidTransactionError);
  });

  it("should reject negative fees", () => {
    expect(() => {
      validateNewTransaction({
        ...baseInput,
        fees: Money.of(-1, "USD"),
      });
    }).toThrow(InvalidTransactionError);
  });

  it("should accept zero fees", () => {
    expect(() => {
      validateNewTransaction({ ...baseInput, fees: Money.zero("USD") });
    }).not.toThrow();
  });

  it("should reject fees in a different currency than price", () => {
    expect(() => {
      validateNewTransaction({
        ...baseInput,
        fees: Money.of(1, "EUR"),
      });
    }).toThrow(InvalidTransactionError);
  });

  it("should reject a future execution date", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    expect(() => {
      validateNewTransaction({ ...baseInput, executedAt: futureDate });
    }).toThrow(InvalidTransactionError);
  });

  it("should accept a past execution date", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    expect(() => {
      validateNewTransaction({ ...baseInput, executedAt: pastDate });
    }).not.toThrow();
  });
});
