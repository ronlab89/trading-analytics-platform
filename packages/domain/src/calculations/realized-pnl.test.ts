import { describe, expect, it } from "vitest";
import { TransactionType } from "../entities/enums.js";
import { Money } from "../value-objects/money.js";
import { InsufficientPositionQuantityError } from "./position-recalculation.js";
import type { ReplayEntry } from "./position-replay.js";
import { replayRealizedPnL } from "./realized-pnl.js";

const day1 = new Date("2026-06-01T12:00:00Z");
const day2 = new Date("2026-06-02T12:00:00Z");
const day3 = new Date("2026-06-03T12:00:00Z");
const day4 = new Date("2026-06-04T12:00:00Z");

function entry(
  type: TransactionType,
  quantity: number,
  price: string,
  executedAt: Date,
  fees = "0",
): ReplayEntry {
  return {
    type,
    quantity,
    price: Money.of(price, "USD"),
    fees: Money.of(fees, "USD"),
    executedAt,
  };
}

function buy(quantity: number, price: string, executedAt: Date, fees = "0"): ReplayEntry {
  return entry(TransactionType.BUY, quantity, price, executedAt, fees);
}

function sell(quantity: number, price: string, executedAt: Date, fees = "0"): ReplayEntry {
  return entry(TransactionType.SELL, quantity, price, executedAt, fees);
}

describe("replayRealizedPnL", () => {
  it("should be zero in the given currency when there are no SELLs", () => {
    const result = replayRealizedPnL([buy(10, "100", day1)], "USD");

    expect(result.total.equals(Money.zero("USD"))).toBe(true);
    expect(result.sales).toEqual([]);
  });

  it("should match the hand-computed example of docs/16-analytics-spec.md §12", () => {
    // d1: BUY 10 @ 10, fees 1 -> average 10.1.
    // d3: SELL 4 @ 11.5, fees 1 -> 4 x (11.5 - 10.1) - 1 = 4.6.
    const result = replayRealizedPnL([buy(10, "10", day1, "1"), sell(4, "11.5", day3, "1")], "USD");

    expect(result.total.equals(Money.of("4.6", "USD"))).toBe(true);
    expect(result.sales).toHaveLength(1);
    expect(result.sales[0]?.executedAt).toEqual(day3);
    expect(result.sales[0]?.quantity).toBe(4);
    expect(result.sales[0]?.realizedPnL.equals(Money.of("4.6", "USD"))).toBe(true);
  });

  it("should subtract the SELL fees from the realized P/L", () => {
    const withoutFees = replayRealizedPnL([buy(10, "10", day1), sell(4, "12", day2)], "USD");
    const withFees = replayRealizedPnL([buy(10, "10", day1), sell(4, "12", day2, "3")], "USD");

    expect(withoutFees.total.equals(Money.of("8", "USD"))).toBe(true);
    expect(withFees.total.equals(Money.of("5", "USD"))).toBe(true);
  });

  it("should report a loss as a negative amount", () => {
    const result = replayRealizedPnL([buy(10, "10", day1), sell(5, "8", day2)], "USD");

    expect(result.total.equals(Money.of("-10", "USD"))).toBe(true);
  });

  it("should add partial SELLs against the same average", () => {
    // Average 10 throughout: 4 x (12 - 10) + 2 x (9 - 10) = 8 - 2 = 6.
    const result = replayRealizedPnL(
      [buy(10, "10", day1), sell(4, "12", day2), sell(2, "9", day3)],
      "USD",
    );

    expect(result.total.equals(Money.of("6", "USD"))).toBe(true);
    expect(result.sales.map((sale) => sale.quantity)).toEqual([4, 2]);
  });

  it("should use the new average after a closed position is reopened", () => {
    // First lot: BUY 5 @ 10, SELL 5 @ 12 -> 10. Reopened at 20: SELL 5 @ 25 -> 25.
    const result = replayRealizedPnL(
      [buy(5, "10", day1), sell(5, "12", day2), buy(5, "20", day3), sell(5, "25", day4)],
      "USD",
    );

    expect(result.total.equals(Money.of("35", "USD"))).toBe(true);
  });

  it("should replay in date order whatever the recording order", () => {
    // Recorded SELL first, dated after the BUY.
    const result = replayRealizedPnL([sell(4, "12", day2), buy(10, "10", day1)], "USD");

    expect(result.total.equals(Money.of("8", "USD"))).toBe(true);
  });

  describe("identifying each sale", () => {
    const withId = (id: string, replayEntry: ReplayEntry): ReplayEntry => ({ ...replayEntry, id });

    it("should carry the id of the transaction that made each sale, in date order", () => {
      const result = replayRealizedPnL(
        [
          withId("b1", buy(10, "10", day1)),
          withId("s2", sell(3, "11", day4)),
          withId("s1", sell(2, "12", day2)),
        ],
        "USD",
      );

      expect(result.sales.map((sale) => sale.transactionId)).toEqual(["s1", "s2"]);
      expect(result.sales.map((sale) => sale.realizedPnL.toString())).toEqual(["4", "3"]);
    });

    it("should reflect a backdated BUY in the sales recorded before it", () => {
      // Recorded in this order: BUY d1 10 @ 10, SELL d4 5 @ 12, then a BUY d2 10 @ 20 backdated.
      // At the SELL the average is (10 x 10 + 10 x 20) / 20 = 15: 5 x (12 - 15) = -15.
      const result = replayRealizedPnL(
        [
          withId("b1", buy(10, "10", day1)),
          withId("s1", sell(5, "12", day4)),
          withId("b2", buy(10, "20", day2)),
        ],
        "USD",
      );

      expect(result.sales).toHaveLength(1);
      expect(result.sales[0]?.transactionId).toBe("s1");
      expect(result.sales[0]?.realizedPnL.toString()).toBe("-15");
    });

    it("should leave the id out when the entries have none", () => {
      const result = replayRealizedPnL([buy(10, "10", day1), sell(4, "12", day2)], "USD");

      expect(result.sales[0]).not.toHaveProperty("transactionId");
    });
  });

  it("should throw when a SELL exceeds what is held at its point of the timeline", () => {
    expect(() => replayRealizedPnL([buy(5, "10", day1), sell(6, "12", day2)], "USD")).toThrow(
      InsufficientPositionQuantityError,
    );
  });
});
