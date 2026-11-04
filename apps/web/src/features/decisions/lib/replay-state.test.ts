import type { DecisionReplayResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { replayStateAt } from "./replay-state";

const usd = (amount: string) => ({ amount, currency: "USD" });

const event = (
  id: string,
  type: DecisionReplayResponse["events"][number]["type"],
  payload: Record<string, unknown>,
  day: number,
) => ({
  id,
  decisionId: "d1",
  timestamp: `2026-08-${String(day).padStart(2, "0")}T10:00:00.000Z`,
  type,
  payload,
});

const replay: DecisionReplayResponse = {
  decision: {
    id: "d1",
    portfolioId: "p1",
    assetId: "a1",
    title: "Buy AAPL",
    thesis: "Services keep growing.",
    direction: "LONG",
    entryPrice: usd("100.00"),
    targetPrice: usd("130.00"),
    stopPrice: usd("90.00"),
    riskLevel: "MODERATE",
    createdAt: "2026-08-01T10:00:00.000Z",
    closedAt: null,
    outcome: null,
    notes: null,
  },
  events: [
    event("e1", "DECISION_CREATED", {}, 1),
    event("e2", "POSITION_OPENED", { quantity: "10", price: "100.00" }, 2),
    event("e3", "PRICE_UPDATE", { price: "110.00" }, 3),
    event("e4", "RISK_CHANGED", { riskLevel: "HIGH" }, 4),
    event("e5", "POSITION_CLOSED", { price: "120.00" }, 5),
  ],
  currency: "USD",
  initialState: {} as DecisionReplayResponse["initialState"],
};

describe("replayStateAt", () => {
  it("is planned before the first event, with the risk the decision started with", () => {
    const state = replayStateAt(replay, -1);

    expect(state).toMatchObject({
      currentIndex: -1,
      totalEvents: 5,
      currentEvent: null,
      phase: "PLANNED",
      riskLevel: "MODERATE",
      position: null,
    });
  });

  it("opens the position at its entry price with the units of the event", () => {
    const state = replayStateAt(replay, 1);

    expect(state.phase).toBe("OPEN");
    expect(state.position).toEqual({ quantity: "10", entryPrice: usd("100") });
    expect(state.currentEvent?.id).toBe("e2");
  });

  it("works out the unrealized result at the last price", () => {
    const state = replayStateAt(replay, 2);

    expect(state.lastPrice).toEqual(usd("110"));
    expect(state.unrealizedPnL).toEqual(usd("100"));
  });

  it("follows a change of risk", () => {
    expect(replayStateAt(replay, 3).riskLevel).toBe("HIGH");
  });

  it("closes the position and keeps what it earned", () => {
    const state = replayStateAt(replay, 4);

    expect(state.phase).toBe("CLOSED");
    expect(state.position).toBeNull();
    expect(state.realizedPnL).toEqual(usd("200"));
  });

  it("gains when a short falls", () => {
    const short = { ...replay, decision: { ...replay.decision, direction: "SHORT" as const } };

    expect(replayStateAt(short, 4).realizedPnL).toEqual(usd("-200"));
  });

  it("does not change the replay it is given", () => {
    const before = JSON.stringify(replay);

    replayStateAt(replay, 4);

    expect(JSON.stringify(replay)).toBe(before);
  });

  it("throws for an index outside the events", () => {
    expect(() => replayStateAt(replay, 5)).toThrow();
    expect(() => replayStateAt(replay, -2)).toThrow();
  });
});
