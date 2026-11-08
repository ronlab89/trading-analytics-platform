import { describe, expect, it } from "vitest";
import { transactionNetTotal, transactionTotal } from "./transaction-total";

describe("transactionNetTotal", () => {
  const operation = { amount: "1802.00", currency: "USD" };
  const fees = { amount: "1.00", currency: "USD" };

  it("adds the fees to a purchase, as the form summary does", () => {
    expect(transactionNetTotal("BUY", operation, fees)).toEqual({
      amount: "1803.00",
      currency: "USD",
    });
  });

  it("takes the fees off a sale", () => {
    expect(transactionNetTotal("SELL", operation, fees)).toEqual({
      amount: "1801.00",
      currency: "USD",
    });
  });
});

describe("transactionTotal", () => {
  it("multiplies the quantity by the price and keeps the currency", () => {
    expect(transactionTotal({ amount: "180.20", currency: "USD" }, 10)).toEqual({
      amount: "1802.00",
      currency: "USD",
    });
  });

  it("rounds to cents instead of leaving a float tail", () => {
    expect(transactionTotal({ amount: "0.10", currency: "EUR" }, 3)).toEqual({
      amount: "0.30",
      currency: "EUR",
    });
  });

  it("handles a fractional quantity", () => {
    expect(transactionTotal({ amount: "410.10", currency: "USD" }, 0.5)).toEqual({
      amount: "205.05",
      currency: "USD",
    });
  });
});
