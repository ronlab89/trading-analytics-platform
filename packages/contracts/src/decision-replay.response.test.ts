import { describe, expect, it } from "vitest";
import { Money, projectDecisionReplay } from "@trading/domain";
import type { Decision, DecisionEvent } from "@trading/domain";
import { decisionReplayResponseSchema, presentDecisionReplay } from "./decision-replay.response.js";

const decision: Decision = {
  id: "d1",
  portfolioId: "p1",
  assetId: "a1",
  title: "Buy BTC",
  thesis: "Because",
  direction: "LONG",
  entryPrice: Money.of("100", "USD"),
  targetPrice: null,
  stopPrice: null,
  riskLevel: "HIGH",
  createdAt: new Date("2026-10-13T12:00:00.000Z"),
  closedAt: null,
  outcome: null,
  notes: null,
};

const events: DecisionEvent[] = [
  {
    id: "e1",
    decisionId: "d1",
    timestamp: new Date("2026-10-13T12:00:00.000Z"),
    type: "POSITION_OPENED",
    payload: { quantity: 2, price: 100 },
  },
  {
    id: "e2",
    decisionId: "d1",
    timestamp: new Date("2026-10-14T12:00:00.000Z"),
    type: "PRICE_UPDATE",
    payload: { price: 110.5 },
  },
  {
    id: "e3",
    decisionId: "d1",
    timestamp: new Date("2026-10-15T12:00:00.000Z"),
    type: "POSITION_CLOSED",
    payload: { price: 120 },
  },
  {
    id: "e4",
    decisionId: "d1",
    timestamp: new Date("2026-10-16T12:00:00.000Z"),
    type: "POSITION_ADJUSTED",
    payload: { quantity: "bad" },
  },
];

describe("decision replay presenter", () => {
  it.each([
    ["no events", []],
    ["a full history with a malformed event", events],
  ])("serializes the replay for %s exactly as before", (_name, evs) => {
    const replay = {
      decision,
      events: evs,
      currency: "USD",
      initialState: projectDecisionReplay({ decision, events: evs, currency: "USD" }, -1),
    };
    const dto = presentDecisionReplay(replay);
    expect(dto).toEqual(JSON.parse(JSON.stringify(replay)));
    expect(decisionReplayResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("presents an open position with its money as decimal strings", () => {
    const state = projectDecisionReplay({ decision, events, currency: "USD" }, 1);
    const dto = presentDecisionReplay({ decision, events, currency: "USD", initialState: state });
    expect(dto.initialState.position).toEqual({
      quantity: 2,
      entryPrice: { amount: "100", currency: "USD" },
    });
    expect(dto.initialState.lastPrice).toEqual({ amount: "110.5", currency: "USD" });
    expect(dto.initialState.currentEvent?.timestamp).toBe("2026-10-14T12:00:00.000Z");
  });
});
