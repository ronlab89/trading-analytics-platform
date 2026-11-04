import type { DecisionResponse, HistoricalPriceResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { historyRangeOf, priceDomain, priceLevelsOf, toPriceSeries } from "./price-series";

const usd = (amount: string) => ({ amount, currency: "USD" });

const candle = (day: string, close: string): HistoricalPriceResponse => ({
  assetId: "a1",
  timestamp: `${day}T00:00:00.000Z`,
  open: usd(close),
  high: usd(close),
  low: usd(close),
  close: usd(close),
  volume: 100,
});

const candles = [
  candle("2026-08-12", "160"),
  candle("2026-08-13", "165"),
  candle("2026-08-14", "170"),
];

const decision = {
  entryPrice: usd("162.40"),
  targetPrice: usd("190.00"),
  stopPrice: usd("158.00"),
  createdAt: "2026-08-12T10:05:00.000Z",
  closedAt: null,
} as DecisionResponse;

describe("toPriceSeries", () => {
  it("splits the line at the current event, both parts sharing that day so they join", () => {
    const { points, cursor } = toPriceSeries(candles, "2026-08-13T15:40:00.000Z");

    expect(points).toEqual([
      { date: "2026-08-12", close: 160, played: 160, upcoming: null },
      { date: "2026-08-13", close: 165, played: 165, upcoming: 165 },
      { date: "2026-08-14", close: 170, played: null, upcoming: 170 },
    ]);
    expect(cursor).toEqual({ date: "2026-08-13", close: 165, index: 1 });
  });

  it("stays on the last known day when the event falls on a day without a candle", () => {
    const { cursor } = toPriceSeries(
      [candle("2026-08-14", "170"), candle("2026-08-17", "172")],
      "2026-08-15T12:00:00.000Z",
    );

    expect(cursor).toEqual({ date: "2026-08-14", close: 170, index: 0 });
  });

  it("has everything still to come when the event is before the first candle", () => {
    const { points, cursor } = toPriceSeries(candles, "2026-08-01T12:00:00.000Z");

    expect(cursor).toBeNull();
    expect(points.every((point) => point.played === null)).toBe(true);
    expect(points.map((point) => point.upcoming)).toEqual([160, 165, 170]);
  });

  it("has nothing still to come on the last event", () => {
    const { points, cursor } = toPriceSeries(candles, "2026-08-14T23:00:00.000Z");

    expect(cursor?.index).toBe(2);
    expect(points.map((point) => point.upcoming)).toEqual([null, null, 170]);
  });

  it("has everything still to come without an event", () => {
    expect(toPriceSeries(candles, null).cursor).toBeNull();
  });
});

describe("priceLevelsOf", () => {
  it("gives the prices the decision sets, as numbers", () => {
    expect(priceLevelsOf(decision)).toEqual([
      { key: "target", price: usd("190.00"), value: 190 },
      { key: "entry", price: usd("162.40"), value: 162.4 },
      { key: "stop", price: usd("158.00"), value: 158 },
    ]);
  });

  it("leaves out a price the decision does not set", () => {
    expect(
      priceLevelsOf({ ...decision, stopPrice: null, targetPrice: null }).map((level) => level.key),
    ).toEqual(["entry"]);
  });
});

describe("priceDomain", () => {
  const points = toPriceSeries(candles, null).points;

  it("fits the prices and the levels, with some room around them", () => {
    expect(priceDomain(points, [{ value: 200 }, { value: 150 }])).toEqual([145, 205]);
  });

  it("fits only the prices when there are no levels", () => {
    expect(priceDomain(points, [])).toEqual([159, 171]);
  });

  it("still has room when every price is the same", () => {
    const [low, high] = priceDomain(toPriceSeries([candle("2026-08-12", "100")], null).points, []);

    expect(low).toBeLessThan(100);
    expect(high).toBeGreaterThan(100);
  });
});

describe("historyRangeOf", () => {
  const now = new Date("2026-10-06T14:00:00.000Z");

  it("goes from the day of the decision to today while it is open", () => {
    expect(historyRangeOf(decision, now)).toEqual({ from: "2026-08-12", to: "2026-10-06" });
  });

  it("ends the day the decision closed", () => {
    expect(historyRangeOf({ ...decision, closedAt: "2026-09-20T09:00:00.000Z" }, now)).toEqual({
      from: "2026-08-12",
      to: "2026-09-20",
    });
  });
});
