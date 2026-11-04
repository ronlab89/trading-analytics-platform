import type { DecisionReplayStateResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { currentReturnOf } from "./current-return";

const usd = (amount: string) => ({ amount, currency: "USD" });

const state = (overrides: Partial<DecisionReplayStateResponse>): DecisionReplayStateResponse => ({
  currentIndex: 2,
  totalEvents: 3,
  currentEvent: null,
  phase: "OPEN",
  thesis: null,
  riskLevel: null,
  notes: [],
  position: { quantity: "10", entryPrice: usd("100") },
  lastPrice: usd("110"),
  unrealizedPnL: usd("100"),
  realizedPnL: null,
  issues: [],
  ...overrides,
});

describe("currentReturnOf", () => {
  it("measures an open long from its entry to the last price", () => {
    expect(currentReturnOf(state({}), "LONG")).toEqual({
      kind: "open",
      percent: 10,
      price: usd("110"),
    });
  });

  it("turns the sign around for a short, which gains when the price falls", () => {
    expect(currentReturnOf(state({}), "SHORT")).toEqual({
      kind: "open",
      percent: -10,
      price: usd("110"),
    });
  });

  it("gives what a closed position made and the price it closed at", () => {
    const closed = state({
      phase: "CLOSED",
      position: null,
      unrealizedPnL: null,
      realizedPnL: usd("-50"),
      lastPrice: usd("95"),
    });

    expect(currentReturnOf(closed, "LONG")).toEqual({
      kind: "closed",
      profit: usd("-50"),
      price: usd("95"),
    });
  });

  it("has no answer while no position was opened", () => {
    const planned = state({ phase: "PLANNED", position: null, lastPrice: null });

    expect(currentReturnOf(planned, "LONG")).toEqual({ kind: "none" });
  });

  it("has no answer for an open position without a price", () => {
    expect(currentReturnOf(state({ lastPrice: null }), "LONG")).toEqual({ kind: "none" });
  });
});
