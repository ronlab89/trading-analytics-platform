import { describe, expect, it } from "vitest";
import { TransactionType } from "../entities/enums";
import { Money } from "../value-objects/money";
import { InsufficientPositionQuantityError } from "./position-recalculation";
import { replayPosition } from "./position-replay";
import type { ReplayEntry } from "./position-replay";

const day1 = new Date("2026-06-01T12:00:00Z");
const day2 = new Date("2026-06-02T12:00:00Z");
const day3 = new Date("2026-06-03T12:00:00Z");

function buy(quantity: number, price: string, executedAt: Date): ReplayEntry {
  return { type: TransactionType.BUY, quantity, price: Money.of(price, "USD"), executedAt };
}

function sell(quantity: number, executedAt: Date): ReplayEntry {
  return { type: TransactionType.SELL, quantity, price: Money.of("1", "USD"), executedAt };
}

describe("replayPosition", () => {
  it("should return null when there is no history", () => {
    expect(replayPosition([])).toBeNull();
  });

  it("should open a position at the BUY price and date", () => {
    const result = replayPosition([buy(10, "100", day1)]);

    expect(result?.quantity).toBe(10);
    expect(result?.averageEntryPrice.equals(Money.of("100", "USD"))).toBe(true);
    expect(result?.openedAt).toEqual(day1);
  });

  it("should blend BUY prices into a weighted average and keep the first openedAt", () => {
    const result = replayPosition([buy(10, "100", day1), buy(10, "200", day2)]);

    expect(result?.quantity).toBe(20);
    expect(result?.averageEntryPrice.equals(Money.of("150", "USD"))).toBe(true);
    expect(result?.openedAt).toEqual(day1);
  });

  it("should move openedAt back when a BUY is backdated", () => {
    // Recorded second, dated first.
    const result = replayPosition([buy(10, "200", day2), buy(10, "100", day1)]);

    expect(result?.averageEntryPrice.equals(Money.of("150", "USD"))).toBe(true);
    expect(result?.openedAt).toEqual(day1);
  });

  it("should give a different average when a backdated BUY lands before a SELL", () => {
    // Date order: BUY 10@100, BUY 6@200, SELL 4 -> (1000 + 1200) / 16 = 137.5.
    // Applied after the SELL instead, it would be (600 + 1200) / 12 = 150.
    const result = replayPosition([buy(10, "100", day1), sell(4, day3), buy(6, "200", day2)]);

    expect(result?.quantity).toBe(12);
    expect(result?.averageEntryPrice.equals(Money.of("137.5", "USD"))).toBe(true);
  });

  it("should leave the average untouched on a partial SELL", () => {
    const result = replayPosition([buy(10, "100", day1), sell(4, day2)]);

    expect(result?.quantity).toBe(6);
    expect(result?.averageEntryPrice.equals(Money.of("100", "USD"))).toBe(true);
    expect(result?.openedAt).toEqual(day1);
  });

  it("should return null when a SELL closes the position exactly", () => {
    expect(replayPosition([buy(10, "100", day1), sell(10, day2)])).toBeNull();
  });

  it("should reopen a closed position with the new BUY price and date", () => {
    const result = replayPosition([buy(10, "100", day1), sell(10, day2), buy(5, "300", day3)]);

    expect(result?.quantity).toBe(5);
    expect(result?.averageEntryPrice.equals(Money.of("300", "USD"))).toBe(true);
    expect(result?.openedAt).toEqual(day3);
  });

  it("should replay a BUY and a SELL sharing a timestamp in creation order", () => {
    expect(replayPosition([buy(10, "100", day1), sell(10, day1)])).toBeNull();

    expect(() => replayPosition([sell(10, day1), buy(10, "100", day1)])).toThrow(
      InsufficientPositionQuantityError,
    );
  });

  it("should throw when a SELL exceeds what is held at its point of the timeline", () => {
    expect(() => replayPosition([buy(5, "100", day1), sell(6, day2)])).toThrow(
      InsufficientPositionQuantityError,
    );
  });
});
