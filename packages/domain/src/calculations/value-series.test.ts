import { describe, expect, it } from "vitest";
import { TransactionType } from "../entities/enums.js";
import { CurrencyMismatchError, Money } from "../value-objects/money.js";
import { buildQuantityTimeline } from "./quantity-timeline.js";
import type { QuantityEntry } from "./quantity-timeline.js";
import { buildValueSeries } from "./value-series.js";
import type { PriceCandle } from "./value-series.js";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

const buy = (assetId: string, quantity: number, executedAt: string): QuantityEntry => ({
  assetId,
  type: TransactionType.BUY,
  quantity,
  executedAt: new Date(executedAt),
});

const sell = (assetId: string, quantity: number, executedAt: string): QuantityEntry => ({
  assetId,
  type: TransactionType.SELL,
  quantity,
  executedAt: new Date(executedAt),
});

const candle = (
  assetId: string,
  timestamp: string,
  close: string,
  currency = "USD",
): PriceCandle => ({
  assetId,
  timestamp: new Date(timestamp),
  close: Money.of(close, currency),
});

/** The series of `entries` and `candles` over 1 to 3 March 2026, as `[amount | null, status]`. */
function series(entries: QuantityEntry[], candles: PriceCandle[], from = "2026-03-01") {
  const timeline = buildQuantityTimeline(entries, utc(from), utc("2026-03-03"));

  return buildValueSeries(timeline, candles, "USD").map((day) => [
    day.value === null ? null : day.value.toString(),
    day.status,
  ]);
}

describe("buildValueSeries", () => {
  it("should value the worked example of docs/16-analytics-spec.md §7", () => {
    // d1: BUY 10, close 10.5. d2: close 11. d3: SELL 4, close 12.
    const result = series(
      [buy("a1", 10, "2026-03-01T09:00:00Z"), sell("a1", 4, "2026-03-03T09:00:00Z")],
      [
        candle("a1", "2026-03-01T00:00:00Z", "10.5"),
        candle("a1", "2026-03-02T00:00:00Z", "11"),
        candle("a1", "2026-03-03T00:00:00Z", "12"),
      ],
    );

    expect(result).toEqual([
      ["105", "OK"],
      ["110", "OK"],
      ["72", "OK"],
    ]);
  });

  it("should carry the last close forward over days without a candle", () => {
    const result = series(
      [buy("a1", 2, "2026-03-01T09:00:00Z")],
      [candle("a1", "2026-03-01T00:00:00Z", "10")],
    );

    expect(result).toEqual([
      ["20", "OK"],
      ["20", "OK"],
      ["20", "OK"],
    ]);
  });

  it("should carry forward a close from before the range", () => {
    const result = series(
      [buy("a1", 2, "2026-02-20T09:00:00Z")],
      [candle("a1", "2026-02-27T00:00:00Z", "10")],
    );

    expect(result).toEqual([
      ["20", "OK"],
      ["20", "OK"],
      ["20", "OK"],
    ]);
  });

  it("should report a held asset without any candle yet as insufficient data, never zero", () => {
    const result = series(
      [buy("a1", 2, "2026-03-01T09:00:00Z")],
      [candle("a1", "2026-03-03T00:00:00Z", "10")],
    );

    expect(result).toEqual([
      [null, "INSUFFICIENT_DATA"],
      [null, "INSUFFICIENT_DATA"],
      ["20", "OK"],
    ]);
  });

  it("should not use a candle dated after the day", () => {
    const result = series(
      [buy("a1", 1, "2026-03-01T09:00:00Z")],
      [candle("a1", "2026-03-02T00:00:00Z", "10")],
    );

    expect(result[0]).toEqual([null, "INSUFFICIENT_DATA"]);
  });

  it("should need no price for an asset that is not held at the end of the day", () => {
    const result = series(
      [buy("a1", 3, "2026-03-01T09:00:00Z"), sell("a1", 3, "2026-03-01T15:00:00Z")],
      [],
    );

    expect(result).toEqual([
      ["0", "OK"],
      ["0", "OK"],
      ["0", "OK"],
    ]);
  });

  it("should add up the value of several assets and ignore candles of others", () => {
    const result = series(
      [buy("a1", 2, "2026-03-01T09:00:00Z"), buy("a2", 5, "2026-03-02T09:00:00Z")],
      [
        candle("a1", "2026-03-01T00:00:00Z", "10"),
        candle("a2", "2026-03-02T00:00:00Z", "4"),
        candle("a3", "2026-03-01T00:00:00Z", "999"),
      ],
    );

    expect(result).toEqual([
      ["20", "OK"],
      ["40", "OK"],
      ["40", "OK"],
    ]);
  });

  it("should value the days before the first transaction at zero", () => {
    const result = series(
      [buy("a1", 1, "2026-03-03T09:00:00Z")],
      [candle("a1", "2026-03-03T00:00:00Z", "10")],
    );

    expect(result).toEqual([
      ["0", "OK"],
      ["0", "OK"],
      ["10", "OK"],
    ]);
  });

  it("should take the latest candle of a day as its close", () => {
    const result = series(
      [buy("a1", 1, "2026-03-01T09:00:00Z")],
      [candle("a1", "2026-03-01T20:00:00Z", "12"), candle("a1", "2026-03-01T08:00:00Z", "10")],
    );

    expect(result[0]).toEqual(["12", "OK"]);
  });

  it("should return no series when there are no transactions", () => {
    expect(series([], [candle("a1", "2026-03-01T00:00:00Z", "10")])).toEqual([]);
  });

  it("should throw when a close is in another currency", () => {
    expect(() =>
      series(
        [buy("a1", 1, "2026-03-01T09:00:00Z")],
        [candle("a1", "2026-03-01T00:00:00Z", "10", "EUR")],
      ),
    ).toThrow(CurrencyMismatchError);
  });
});
