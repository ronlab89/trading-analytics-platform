import type { DecisionResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { expectedVsActual, type WorstFall } from "./expected-vs-actual";
import type { PriceCursor, PricePoint } from "./price-series";

const usd = (amount: string) => ({ amount, currency: "USD" });

const decision = {
  direction: "LONG",
  entryPrice: usd("162.40"),
  targetPrice: usd("190.00"),
  riskLevel: "MODERATE",
} as DecisionResponse;

const point = (date: string, close: number): PricePoint => ({
  date,
  close,
  played: close,
  upcoming: null,
});

const points = [
  point("2026-08-12", 160),
  point("2026-08-14", 162.4),
  point("2026-08-19", 160.1),
  point("2026-08-24", 166.3),
  point("2026-08-28", 173.5),
];

const cursorAt = (index: number): PriceCursor => {
  const found = points[index];
  if (found === undefined) throw new Error(`No day at ${String(index)}`);
  return { date: found.date, close: found.close, index };
};

const fallOf = (worst: WorstFall) => (worst.kind === "drawdown" ? worst.percent : Number.NaN);

const OPENED = "2026-08-14T15:40:00.000Z";

describe("expectedVsActual", () => {
  it("compares what a long expected with where the price stands at the current event", () => {
    const rows = expectedVsActual({ decision, points, cursor: cursorAt(4), openedAt: OPENED });

    expect(rows.direction).toEqual({ expected: "LONG", actual: "UP" });
    expect(rows.target.expected).toEqual(usd("190.00"));
    expect(rows.target.price).toBe(173.5);
    expect(rows.target.progress).toBeCloseTo(40.22, 1);
    expect(rows.risk.expected).toBe("MODERATE");
    expect(rows.result.expected).toBeCloseTo(17, 0);
    expect(rows.result.actual).toBeCloseTo(6.83, 1);
  });

  it("measures the worst fall from the day the position opened, not before", () => {
    const rows = expectedVsActual({ decision, points, cursor: cursorAt(4), openedAt: OPENED });

    // 160.10 against 162.40; the 160.00 of the day before the position existed is left out.
    expect(rows.risk.actual.kind).toBe("drawdown");
    expect(fallOf(rows.risk.actual)).toBeCloseTo(-1.42, 2);
  });

  it("only looks at the days up to the current event", () => {
    const rows = expectedVsActual({ decision, points, cursor: cursorAt(1), openedAt: OPENED });

    expect(rows.risk.actual).toEqual({ kind: "calm" });
    expect(rows.direction.actual).toBe("FLAT");
    expect(rows.result.actual).toBe(0);
  });

  it("says the price never fell when it stayed at or above the entry", () => {
    const rising = [point("2026-08-14", 162.4), point("2026-08-19", 170), point("2026-08-24", 175)];

    const rows = expectedVsActual({
      decision,
      points: rising,
      cursor: { date: "2026-08-24", close: 175, index: 2 },
      openedAt: OPENED,
    });

    expect(rows.risk.actual).toEqual({ kind: "calm" });
  });

  it("reads a short the other way: it gains when the price falls and loses when it rises", () => {
    const short = {
      direction: "SHORT",
      entryPrice: usd("100.00"),
      targetPrice: usd("90.00"),
      riskLevel: "HIGH",
    } as DecisionResponse;
    const days = [point("2026-08-14", 100), point("2026-08-19", 103), point("2026-08-24", 95)];

    const rows = expectedVsActual({
      decision: short,
      points: days,
      cursor: { date: "2026-08-24", close: 95, index: 2 },
      openedAt: OPENED,
    });

    expect(rows.direction).toEqual({ expected: "SHORT", actual: "DOWN" });
    expect(rows.target.progress).toBeCloseTo(50, 5);
    expect(rows.result.expected).toBeCloseTo(10, 5);
    expect(rows.result.actual).toBeCloseTo(5, 5);
    expect(rows.risk.actual.kind).toBe("drawdown");
    expect(fallOf(rows.risk.actual)).toBeCloseTo(-3, 5);
  });

  it("leaves the real column empty before the position opens", () => {
    const rows = expectedVsActual({ decision, points, cursor: cursorAt(0), openedAt: OPENED });

    expect(rows.direction).toEqual({ expected: "LONG", actual: null });
    expect(rows.target.price).toBeNull();
    expect(rows.target.progress).toBeNull();
    expect(rows.risk.actual).toEqual({ kind: "none" });
    expect(rows.result.actual).toBeNull();
    expect(rows.result.expected).toBeCloseTo(17, 0);
  });

  it("leaves the real column empty when no position was ever opened", () => {
    const rows = expectedVsActual({ decision, points, cursor: cursorAt(4), openedAt: null });

    expect(rows.direction.actual).toBeNull();
    expect(rows.target.price).toBeNull();
    expect(rows.result.actual).toBeNull();
  });

  it("leaves the real column empty when there is no price for the current event", () => {
    const rows = expectedVsActual({ decision, points, cursor: null, openedAt: OPENED });

    expect(rows.direction.actual).toBeNull();
    expect(rows.risk.actual).toEqual({ kind: "none" });
    expect(rows.result.actual).toBeNull();
    expect(rows.target.expected).toEqual(usd("190.00"));
  });

  it("has no figure that needs a price the decision does not set", () => {
    const rows = expectedVsActual({
      decision: { ...decision, targetPrice: null },
      points,
      cursor: cursorAt(4),
      openedAt: OPENED,
    });
    expect(rows.target.expected).toBeNull();
    expect(rows.target.progress).toBeNull();
    expect(rows.result.expected).toBeNull();
    expect(rows.result.actual).toBeCloseTo(6.83, 1);

    const noEntry = expectedVsActual({
      decision: { ...decision, entryPrice: null },
      points,
      cursor: cursorAt(4),
      openedAt: OPENED,
    });
    expect(noEntry.direction.actual).toBeNull();
    expect(noEntry.risk.actual).toEqual({ kind: "none" });
    expect(noEntry.result).toEqual({ expected: null, actual: null });
  });

  it("says nothing of a target that is the entry itself", () => {
    const rows = expectedVsActual({
      decision: { ...decision, targetPrice: usd("162.40") },
      points,
      cursor: cursorAt(4),
      openedAt: OPENED,
    });

    expect(rows.target.progress).toBeNull();
  });
});
