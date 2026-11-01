import { describe, expect, it } from "vitest";
import { transactionImpact } from "./transaction-impact";

const buy = {
  type: "BUY",
  quantity: "10",
  price: "180.20",
  fees: "1.00",
  currency: "USD",
  held: 236,
};

describe("transactionImpact", () => {
  it("works out the Figma example: 10 × $180.20 plus $1.00, from 236 to 246", () => {
    expect(transactionImpact(buy)).toEqual({
      quantity: 10,
      price: { amount: "180.20", currency: "USD" },
      operation: { amount: "1802.00", currency: "USD" },
      fees: { amount: "1.00", currency: "USD" },
      total: { amount: "1803.00", currency: "USD" },
      position: { from: 236, to: 246 },
    });
  });

  it("takes the fees off the total and the units off the position on a sale", () => {
    const impact = transactionImpact({ ...buy, type: "SELL" });

    expect(impact?.total).toEqual({ amount: "1801.00", currency: "USD" });
    expect(impact?.position).toEqual({ from: 236, to: 226 });
  });

  it("counts empty fees as zero", () => {
    const impact = transactionImpact({ ...buy, fees: "" });

    expect(impact?.fees.amount).toBe("0.00");
    expect(impact?.total.amount).toBe("1802.00");
  });

  it("counts invalid fees as zero instead of guessing", () => {
    expect(transactionImpact({ ...buy, fees: "1,0" })?.fees.amount).toBe("0.00");
  });

  it("rounds to cents instead of leaving a float tail", () => {
    const impact = transactionImpact({ ...buy, quantity: "3", price: "0.10", fees: "0.10" });

    expect(impact?.operation.amount).toBe("0.30");
    expect(impact?.total.amount).toBe("0.40");
  });

  it("handles a fractional quantity", () => {
    expect(transactionImpact({ ...buy, quantity: "0.5", held: 1 })?.position).toEqual({
      from: 1,
      to: 1.5,
    });
  });

  it("is null until the quantity and the price are numbers above zero", () => {
    for (const patch of [
      { quantity: "" },
      { quantity: "0" },
      { quantity: "1." },
      { quantity: "-1" },
      { price: "" },
      { price: "0.00" },
      { price: "abc" },
    ]) {
      expect(transactionImpact({ ...buy, ...patch })).toBeNull();
    }
  });

  it("leaves the position out while the type or the current position is unknown", () => {
    expect(transactionImpact({ ...buy, type: "" })?.position).toBeNull();
    expect(transactionImpact({ ...buy, held: undefined })?.position).toBeNull();
    expect(transactionImpact({ ...buy, type: "" })?.total.amount).toBe("1803.00");
  });

  it("starts from zero when the asset is not held yet", () => {
    expect(transactionImpact({ ...buy, held: 0 })?.position).toEqual({ from: 0, to: 10 });
  });
});
