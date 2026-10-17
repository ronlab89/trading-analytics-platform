import { describe, expect, it } from "vitest";
import { TransactionType } from "../entities/enums";
import { CurrencyMismatchError, Money } from "../value-objects/money";
import { buildDailyFlows, calculateDailyReturn } from "./daily-return";
import type { DailyFlow, FlowEntry } from "./daily-return";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const usd = (amount: string) => Money.of(amount, "USD");

function trade(
  type: TransactionType,
  quantity: number,
  price: string,
  fees: string,
  executedAt: string,
): FlowEntry {
  return { type, quantity, price: usd(price), fees: usd(fees), executedAt: new Date(executedAt) };
}

const buy = (quantity: number, price: string, fees: string, executedAt: string) =>
  trade(TransactionType.BUY, quantity, price, fees, executedAt);
const sell = (quantity: number, price: string, fees: string, executedAt: string) =>
  trade(TransactionType.SELL, quantity, price, fees, executedAt);

const days = [utc("2026-03-01"), utc("2026-03-02"), utc("2026-03-03")];

function flowOf(bought: string, sold: string): DailyFlow {
  return { date: utc("2026-03-01"), bought: usd(bought), sold: usd(sold) };
}

describe("buildDailyFlows", () => {
  it("should add fees to the BUY inflow and subtract them from the SELL outflow", () => {
    // The worked example of docs/16-analytics-spec.md §7.
    const flows = buildDailyFlows(
      [buy(10, "10", "1", "2026-03-01T09:00:00Z"), sell(4, "11.5", "1", "2026-03-03T09:00:00Z")],
      days,
      "USD",
    );

    expect(flows.map((flow) => [flow.bought.toString(), flow.sold.toString()])).toEqual([
      ["101", "0"],
      ["0", "0"],
      ["0", "45"],
    ]);
    expect(flows.map((flow) => flow.date)).toEqual(days);
  });

  it("should add up several trades of one day, BUYs and SELLs apart", () => {
    const flows = buildDailyFlows(
      [
        buy(1, "10", "0", "2026-03-02T08:00:00Z"),
        buy(2, "10", "1", "2026-03-02T09:00:00Z"),
        sell(1, "12", "0.5", "2026-03-02T10:00:00Z"),
      ],
      days,
      "USD",
    );

    expect(flows[1]?.bought.toString()).toBe("31");
    expect(flows[1]?.sold.toString()).toBe("11.5");
  });

  it("should count a SELL whose fees equal its gross proceeds as a zero outflow", () => {
    const flows = buildDailyFlows([sell(2, "5", "10", "2026-03-01T09:00:00Z")], days, "USD");

    expect(flows[0]?.sold.toString()).toBe("0");
  });

  it("should ignore trades outside the days", () => {
    const flows = buildDailyFlows(
      [buy(1, "10", "0", "2026-02-28T23:59:59Z"), buy(1, "10", "0", "2026-03-04T00:00:00Z")],
      days,
      "USD",
    );

    expect(flows.every((flow) => flow.bought.isZero() && flow.sold.isZero())).toBe(true);
  });

  it("should return zero flows for every day when there are no trades", () => {
    const flows = buildDailyFlows([], days, "USD");

    expect(flows).toHaveLength(3);
    expect(flows[0]?.bought.equals(Money.zero("USD"))).toBe(true);
  });

  it("should throw when a trade is in another currency", () => {
    const euro: FlowEntry = {
      type: TransactionType.BUY,
      quantity: 1,
      price: Money.of("10", "EUR"),
      fees: Money.of("0", "EUR"),
      executedAt: new Date("2026-03-01T09:00:00Z"),
    };

    expect(() => buildDailyFlows([euro], days, "USD")).toThrow(CurrencyMismatchError);
  });
});

describe("calculateDailyReturn", () => {
  it("should measure a full liquidation against the previous close", () => {
    // V(d-1) = 100, everything sold for 110: (0 + 110) / (100 + 0) - 1 = +10%.
    const result = calculateDailyReturn(usd("100"), flowOf("0", "110"), usd("0"));

    expect(result?.toFixed(8)).toBe("0.10000000");
  });

  it("should let BUY fees reduce the return of a first-day purchase", () => {
    // BUY 10 @ 10 with fees 1, close 10.5: 105 / 101 - 1.
    const result = calculateDailyReturn(usd("0"), flowOf("101", "0"), usd("105"));

    expect(result?.toFixed(8)).toBe("0.03960396");
  });

  it("should be zero for a partial sale at the previous close", () => {
    // V(d-1) = 100, SELL 4 @ 10 leaves 60: (60 + 40) / 100 - 1.
    const result = calculateDailyReturn(usd("100"), flowOf("0", "40"), usd("60"));

    expect(result?.isZero()).toBe(true);
  });

  it("should apply both flows when the same day buys and sells", () => {
    // (110 + 20) / (100 + 30) - 1 = 0.
    const result = calculateDailyReturn(usd("100"), flowOf("30", "20"), usd("110"));

    expect(result?.isZero()).toBe(true);
  });

  it("should have no return when the denominator is zero, not a zero return", () => {
    expect(calculateDailyReturn(usd("0"), flowOf("0", "0"), usd("0"))).toBeNull();
  });
});
