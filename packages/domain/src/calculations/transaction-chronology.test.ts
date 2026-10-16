import { describe, expect, it } from "vitest";
import { TransactionType } from "../entities/enums";
import { InsufficientPositionQuantityError } from "./position-recalculation";
import { assertChronologicallyValid } from "./transaction-chronology";
import type { ChronologyEntry } from "./transaction-chronology";

const day1 = new Date("2026-06-01T12:00:00Z");
const day2 = new Date("2026-06-02T12:00:00Z");
const day3 = new Date("2026-06-03T12:00:00Z");

function buy(quantity: number, executedAt: Date): ChronologyEntry {
  return { type: TransactionType.BUY, quantity, executedAt };
}

function sell(quantity: number, executedAt: Date): ChronologyEntry {
  return { type: TransactionType.SELL, quantity, executedAt };
}

describe("assertChronologicallyValid", () => {
  it("should accept a SELL after the BUY that covers it", () => {
    expect(() => {
      assertChronologicallyValid([buy(10, day1)], sell(5, day2));
    }).not.toThrow();
  });

  it("should reject a SELL dated before the only BUY", () => {
    expect(() => {
      assertChronologicallyValid([buy(10, day2)], sell(5, day1));
    }).toThrow(InsufficientPositionQuantityError);
  });

  it("should accept a backdated BUY", () => {
    expect(() => {
      assertChronologicallyValid([buy(10, day2)], buy(5, day1));
    }).not.toThrow();
  });

  it("should reject a backdated SELL that makes a later SELL oversell", () => {
    const history = [buy(10, day1), sell(6, day3)];

    expect(() => {
      assertChronologicallyValid(history, sell(6, day2));
    }).toThrow(InsufficientPositionQuantityError);
  });

  it("should accept a backdated SELL that leaves every later SELL covered", () => {
    const history = [buy(10, day1), sell(4, day3)];

    expect(() => {
      assertChronologicallyValid(history, sell(6, day2));
    }).not.toThrow();
  });

  it("should accept a SELL that exactly closes the position", () => {
    expect(() => {
      assertChronologicallyValid([buy(10, day1)], sell(10, day2));
    }).not.toThrow();
  });

  it("should reject a SELL when the asset has no history", () => {
    expect(() => {
      assertChronologicallyValid([], sell(1, day1));
    }).toThrow(InsufficientPositionQuantityError);
  });

  it("should order a BUY created before a SELL first when they share a timestamp", () => {
    // History in creation order: the BUY came first, so the new SELL is covered.
    expect(() => {
      assertChronologicallyValid([buy(10, day1)], sell(10, day1));
    }).not.toThrow();
  });

  it("should order a new BUY after an existing SELL when they share a timestamp", () => {
    // The SELL was created first, so it replays before the new BUY and oversells.
    expect(() => {
      assertChronologicallyValid([sell(5, day1)], buy(10, day1));
    }).toThrow(InsufficientPositionQuantityError);
  });

  it("should keep creation order among history entries that share a timestamp", () => {
    // BUY then SELL at the same instant is valid; the reverse order is not.
    expect(() => {
      assertChronologicallyValid([buy(10, day1), sell(10, day1)], buy(1, day2));
    }).not.toThrow();

    expect(() => {
      assertChronologicallyValid([sell(10, day1), buy(10, day1)], buy(1, day2));
    }).toThrow(InsufficientPositionQuantityError);
  });

  it("should not depend on the history array order when timestamps differ", () => {
    const history = [sell(5, day2), buy(10, day1)];

    expect(() => {
      assertChronologicallyValid(history, buy(1, day3));
    }).not.toThrow();
  });
});
