import { describe, expect, it } from "vitest";
import { TransactionType } from "../entities/enums.js";
import { InsufficientPositionQuantityError } from "./position-recalculation.js";
import { buildQuantityTimeline } from "./quantity-timeline.js";
import type { QuantityEntry } from "./quantity-timeline.js";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

function entry(
  assetId: string,
  type: TransactionType,
  quantity: number,
  executedAt: string,
): QuantityEntry {
  return { assetId, type, quantity, executedAt: new Date(executedAt) };
}

const buy = (assetId: string, quantity: number, executedAt: string) =>
  entry(assetId, TransactionType.BUY, quantity, executedAt);
const sell = (assetId: string, quantity: number, executedAt: string) =>
  entry(assetId, TransactionType.SELL, quantity, executedAt);

describe("buildQuantityTimeline", () => {
  it("should list every UTC day of the range and no asset when there are no entries", () => {
    const result = buildQuantityTimeline([], utc("2026-03-10"), utc("2026-03-12"));

    expect(result.days).toEqual([utc("2026-03-10"), utc("2026-03-11"), utc("2026-03-12")]);
    expect(result.byAsset.size).toBe(0);
  });

  it("should hold zero before the first entry and count the entry on its own day", () => {
    const result = buildQuantityTimeline(
      [buy("a1", 10, "2026-03-11T09:30:00Z")],
      utc("2026-03-10"),
      utc("2026-03-13"),
    );

    expect(result.byAsset.get("a1")).toEqual([0, 10, 10, 10]);
  });

  it("should accumulate BUYs and SELLs at the end of each day", () => {
    const result = buildQuantityTimeline(
      [
        buy("a1", 10, "2026-03-10T09:00:00Z"),
        sell("a1", 4, "2026-03-12T09:00:00Z"),
        buy("a1", 6, "2026-03-13T09:00:00Z"),
      ],
      utc("2026-03-10"),
      utc("2026-03-13"),
    );

    expect(result.byAsset.get("a1")).toEqual([10, 10, 6, 12]);
  });

  it("should start from the quantity held before the range", () => {
    const result = buildQuantityTimeline(
      [buy("a1", 10, "2026-01-05T09:00:00Z"), sell("a1", 3, "2026-02-01T09:00:00Z")],
      utc("2026-03-10"),
      utc("2026-03-11"),
    );

    expect(result.byAsset.get("a1")).toEqual([7, 7]);
  });

  it("should keep assets independent", () => {
    const result = buildQuantityTimeline(
      [buy("a1", 10, "2026-03-10T09:00:00Z"), buy("a2", 2, "2026-03-11T09:00:00Z")],
      utc("2026-03-10"),
      utc("2026-03-11"),
    );

    expect(result.byAsset.get("a1")).toEqual([10, 10]);
    expect(result.byAsset.get("a2")).toEqual([0, 2]);
  });

  it("should give the same end-of-day quantity whatever the order within a day", () => {
    const sameInstant = "2026-03-10T09:00:00Z";
    const buyFirst = buildQuantityTimeline(
      [buy("a1", 5, "2026-03-09T09:00:00Z"), buy("a1", 3, sameInstant), sell("a1", 4, sameInstant)],
      utc("2026-03-10"),
      utc("2026-03-10"),
    );
    const sellFirst = buildQuantityTimeline(
      [buy("a1", 5, "2026-03-09T09:00:00Z"), sell("a1", 4, sameInstant), buy("a1", 3, sameInstant)],
      utc("2026-03-10"),
      utc("2026-03-10"),
    );

    expect(buyFirst.byAsset.get("a1")).toEqual([4]);
    expect(sellFirst.byAsset.get("a1")).toEqual(buyFirst.byAsset.get("a1"));
  });

  it("should keep a fully sold asset at zero", () => {
    const result = buildQuantityTimeline(
      [buy("a1", 10, "2026-03-10T09:00:00Z"), sell("a1", 10, "2026-03-11T09:00:00Z")],
      utc("2026-03-10"),
      utc("2026-03-12"),
    );

    expect(result.byAsset.get("a1")).toEqual([10, 0, 0]);
  });

  it("should reach exactly zero when decimal quantities cancel out", () => {
    // 0.1 + 0.2 - 0.3 is 5.55e-17 with plain numbers.
    const result = buildQuantityTimeline(
      [
        buy("a1", 0.1, "2026-03-10T09:00:00Z"),
        buy("a1", 0.2, "2026-03-10T10:00:00Z"),
        sell("a1", 0.3, "2026-03-11T09:00:00Z"),
      ],
      utc("2026-03-10"),
      utc("2026-03-11"),
    );

    expect(result.byAsset.get("a1")).toEqual([0.3, 0]);
  });

  it("should ignore entries after the range, and leave out an asset that only has those", () => {
    const result = buildQuantityTimeline(
      [
        buy("a1", 10, "2026-03-10T09:00:00Z"),
        buy("a1", 5, "2026-03-12T09:00:00Z"),
        buy("a2", 1, "2026-03-12T09:00:00Z"),
      ],
      utc("2026-03-10"),
      utc("2026-03-11"),
    );

    expect(result.byAsset.get("a1")).toEqual([10, 10]);
    expect(result.byAsset.has("a2")).toBe(false);
  });

  it("should split days at UTC midnight", () => {
    const result = buildQuantityTimeline(
      [buy("a1", 1, "2026-03-10T23:59:59.999Z"), buy("a1", 1, "2026-03-11T00:00:00.000Z")],
      utc("2026-03-10"),
      utc("2026-03-11"),
    );

    expect(result.byAsset.get("a1")).toEqual([1, 2]);
  });

  it("should throw when a day ends with a negative quantity", () => {
    expect(() =>
      buildQuantityTimeline(
        [buy("a1", 5, "2026-03-10T09:00:00Z"), sell("a1", 6, "2026-03-11T09:00:00Z")],
        utc("2026-03-10"),
        utc("2026-03-12"),
      ),
    ).toThrow(InsufficientPositionQuantityError);
  });

  it("should return no days when `from` is after `to`", () => {
    const result = buildQuantityTimeline(
      [buy("a1", 5, "2026-03-10T09:00:00Z")],
      utc("2026-03-12"),
      utc("2026-03-10"),
    );

    expect(result.days).toEqual([]);
    expect(result.byAsset.get("a1")).toEqual([]);
  });
});
