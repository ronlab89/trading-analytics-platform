import { describe, expect, it } from "vitest";
import { TransactionType } from "../entities/enums";
import { buildQuantityTimeline } from "./quantity-timeline";
import type { QuantityEntry } from "./quantity-timeline";
import { detectPositionEvents } from "./position-events";

const day = (n: number) => new Date(Date.UTC(2026, 2, n));

const trade = (
  assetId: string,
  type: QuantityEntry["type"],
  n: number,
  quantity: number,
): QuantityEntry => ({ assetId, type, quantity, executedAt: day(n) });
const buy = (assetId: string, n: number, quantity: number) =>
  trade(assetId, TransactionType.BUY, n, quantity);
const sell = (assetId: string, n: number, quantity: number) =>
  trade(assetId, TransactionType.SELL, n, quantity);

const symbols = new Map([
  ["a1", "AAA"],
  ["b1", "BBB"],
]);

/** The events of the days after d0, the baseline, up to d5. */
function events(entries: QuantityEntry[], baseline = day(0)) {
  return detectPositionEvents(
    buildQuantityTimeline(entries, day(0), day(5)),
    symbols,
    baseline,
  ).map((event) => [event.type, event.date.getUTCDate(), event.symbol]);
}

describe("detectPositionEvents", () => {
  it("should report a position that opens", () => {
    expect(events([buy("a1", 2, 3)])).toEqual([["POSITION_OPENED", 2, "AAA"]]);
  });

  it("should report a position that closes once its quantity reaches zero", () => {
    expect(events([buy("a1", -3, 3), sell("a1", 4, 3)])).toEqual([["POSITION_CLOSED", 4, "AAA"]]);
  });

  it("should report both events, in date order, for a position that opens and closes", () => {
    expect(events([buy("a1", 1, 3), sell("a1", 4, 3)])).toEqual([
      ["POSITION_OPENED", 1, "AAA"],
      ["POSITION_CLOSED", 4, "AAA"],
    ]);
  });

  it("should report a reopened position as closed and then opened", () => {
    expect(events([buy("a1", -2, 1), sell("a1", 1, 1), buy("a1", 3, 2)])).toEqual([
      ["POSITION_CLOSED", 1, "AAA"],
      ["POSITION_OPENED", 3, "AAA"],
    ]);
  });

  it("should not report a position already held at the baseline, nor a change of quantity", () => {
    expect(events([buy("a1", -2, 5), buy("a1", 2, 1), sell("a1", 3, 2)])).toEqual([]);
  });

  it("should report nothing for a purchase and a full sale on the same day", () => {
    // The quantity is measured at the end of the day, so it never leaves zero.
    expect(events([buy("a1", 2, 3), sell("a1", 2, 3)])).toEqual([]);
  });

  it("should order the events by date and then by symbol", () => {
    expect(events([buy("b1", 2, 1), buy("a1", 2, 1)])).toEqual([
      ["POSITION_OPENED", 2, "AAA"],
      ["POSITION_OPENED", 2, "BBB"],
    ]);
    expect(events([buy("a1", 3, 1), buy("b1", 1, 1)])).toEqual([
      ["POSITION_OPENED", 1, "BBB"],
      ["POSITION_OPENED", 3, "AAA"],
    ]);
  });

  it("should leave out the days up to the baseline when the period is clamped", () => {
    // d1 is before the baseline d2: the opening of a1 is already in the baseline.
    expect(events([buy("a1", 1, 3), buy("b1", 3, 1)], day(2))).toEqual([
      ["POSITION_OPENED", 3, "BBB"],
    ]);
  });

  it("should use the asset id when the symbol is unknown", () => {
    const timeline = buildQuantityTimeline([buy("zz", 1, 1)], day(0), day(3));

    expect(detectPositionEvents(timeline, new Map(), day(0))[0]?.symbol).toBe("zz");
  });

  it("should report nothing for an empty timeline", () => {
    expect(events([])).toEqual([]);
  });
});
