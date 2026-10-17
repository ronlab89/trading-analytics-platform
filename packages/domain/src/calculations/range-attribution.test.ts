import { describe, expect, it } from "vitest";
import { TransactionType } from "../entities/enums";
import { Money } from "../value-objects/money";
import { buildQuantityTimeline } from "./quantity-timeline";
import { calculateRangeAttribution, groupContributions } from "./range-attribution";
import type { AttributionEntry } from "./range-attribution";
import type { PriceCandle } from "./value-series";

const day = (n: number) => new Date(Date.UTC(2026, 2, n));
const usd = (amount: string) => Money.of(amount, "USD");

const entry = (
  assetId: string,
  type: AttributionEntry["type"],
  n: number,
  quantity: number,
  price: string,
  fees = "0",
): AttributionEntry => ({
  assetId,
  type,
  quantity,
  price: usd(price),
  fees: usd(fees),
  executedAt: day(n),
});

const candle = (assetId: string, n: number, close: string): PriceCandle => ({
  assetId,
  timestamp: day(n),
  close: usd(close),
});

/**
 * The worked example of docs/16-analytics-spec.md §14, over d0 (the baseline) to d3:
 *   A: BUY 10 @ 10 (fees 1) on d1, SELL 4 @ 11.5 (fees 1) on d3, closes 10.5, 11, 12
 *      contribution 72 - 0 - (101 - 45) = 16
 *   B: BUY 2 @ 10 on d1, closes 9, 8, 7.5
 *      contribution 15 - 0 - 20 = -5
 * The period P/L is 11.
 */
const entries = [
  entry("A", TransactionType.BUY, 1, 10, "10", "1"),
  entry("A", TransactionType.SELL, 3, 4, "11.5", "1"),
  entry("B", TransactionType.BUY, 1, 2, "10"),
];
const candles = [
  candle("A", 1, "10.5"),
  candle("A", 2, "11"),
  candle("A", 3, "12"),
  candle("B", 1, "9"),
  candle("B", 2, "8"),
  candle("B", 3, "7.5"),
];
const timeline = buildQuantityTimeline(entries, day(0), day(3));

describe("calculateRangeAttribution", () => {
  it("should split the period P/L into the contribution of each asset", () => {
    const result = calculateRangeAttribution(timeline, candles, entries, "USD");

    expect(result.status).toBe("OK");
    expect(result.effectiveFrom).toEqual(day(1));
    expect(
      result.contributions.map((item) => [item.assetId, item.contribution.toString()]),
    ).toEqual([
      ["A", "16"],
      ["B", "-5"],
    ]);
    expect(result.pnl?.toString()).toBe("11");
  });

  it("should sum the contributions to the period P/L exactly", () => {
    const result = calculateRangeAttribution(timeline, candles, entries, "USD");

    const total = result.contributions.reduce(
      (sum, item) => sum.add(item.contribution),
      Money.zero("USD"),
    );

    expect(total.equals(result.pnl ?? Money.zero("USD"))).toBe(true);
  });

  it("should count the whole cost and proceeds of an asset sold out inside the period", () => {
    const sold = [
      entry("A", TransactionType.BUY, 1, 1, "10"),
      entry("A", TransactionType.SELL, 2, 1, "12", "1"),
    ];
    const result = calculateRangeAttribution(
      buildQuantityTimeline(sold, day(0), day(3)),
      [candle("A", 1, "10"), candle("A", 2, "12"), candle("A", 3, "13")],
      sold,
      "USD",
    );

    // 0 - 0 - (10 - 11) = 1: the sale paid 11 net of fees for a cost of 10.
    expect(result.contributions[0]?.contribution.toString()).toBe("1");
    expect(result.pnl?.toString()).toBe("1");
  });

  it("should measure from the first day on which every held asset has a price", () => {
    // B has no close on d1, so the period starts from d2 as the baseline.
    const late = candles.filter((item) => !(item.assetId === "B" && item.timestamp <= day(1)));
    const result = calculateRangeAttribution(timeline, late, entries, "USD");

    expect(result.effectiveFrom).toEqual(day(2));
    // A: 72 - 110 - (0 - 45) = 7. B: 15 - 16 - 0 = -1.
    expect(result.contributions.map((item) => item.contribution.toString())).toEqual(["7", "-1"]);
    expect(result.pnl?.toString()).toBe("6");
  });

  it("should be INSUFFICIENT_DATA with no contributions when the last day has no price", () => {
    const result = calculateRangeAttribution(
      timeline,
      candles.filter((item) => item.assetId === "A"),
      entries,
      "USD",
    );

    expect(result).toEqual({
      status: "INSUFFICIENT_DATA",
      effectiveFrom: null,
      contributions: [],
      pnl: null,
    });
  });

  it("should be an OK, empty attribution for a portfolio without transactions", () => {
    const result = calculateRangeAttribution(
      buildQuantityTimeline([], day(0), day(3)),
      [],
      [],
      "USD",
    );

    expect(result.status).toBe("OK");
    expect(result.effectiveFrom).toBeNull();
    expect(result.contributions).toEqual([]);
    expect(result.pnl?.toString()).toBe("0");
  });
});

describe("groupContributions", () => {
  const result = calculateRangeAttribution(timeline, candles, entries, "USD");

  it("should add up the contributions of each group", () => {
    const types = new Map([
      ["A", "STOCK"],
      ["B", "CRYPTO"],
    ]);

    const groups = groupContributions(result.contributions, (assetId) => types.get(assetId) ?? "");

    expect(groups.map((group) => [group.key, group.contribution.toString()])).toEqual([
      ["CRYPTO", "-5"],
      ["STOCK", "16"],
    ]);
  });

  it("should merge assets of the same group into one", () => {
    const groups = groupContributions(result.contributions, () => "STOCK");

    expect(groups.map((group) => [group.key, group.contribution.toString()])).toEqual([
      ["STOCK", "11"],
    ]);
  });
});
