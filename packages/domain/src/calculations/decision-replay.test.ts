import { describe, expect, it } from "vitest";
import type { Decision } from "../entities/decision";
import type { DecisionEvent } from "../entities/decision-event";
import { DecisionDirection, DecisionEventType } from "../entities/enums";
import { Money } from "../value-objects/money";
import {
  DecisionReplayError,
  projectDecisionReplay,
  type DecisionReplayInput,
} from "./decision-replay";

const CURRENCY = "USD";

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "decision_1",
    portfolioId: "portfolio_1",
    assetId: "asset_1",
    title: "Breakout setup",
    thesis: "Price structure suggests continuation.",
    direction: DecisionDirection.LONG,
    entryPrice: Money.of(150, CURRENCY),
    targetPrice: Money.of(170, CURRENCY),
    stopPrice: Money.of(140, CURRENCY),
    riskLevel: "MODERATE",
    createdAt: new Date("2026-06-01T14:00:00Z"),
    closedAt: null,
    outcome: null,
    notes: null,
    ...overrides,
  };
}

let eventCounter = 0;

function makeEvent(
  type: DecisionEventType,
  payload: Record<string, unknown> = {},
  daysAfterStart = eventCounter,
): DecisionEvent {
  eventCounter += 1;
  return {
    id: `event_${String(eventCounter)}`,
    decisionId: "decision_1",
    timestamp: new Date(Date.UTC(2026, 5, 1 + daysAfterStart, 14)),
    type,
    payload,
  };
}

function makeInput(
  events: readonly DecisionEvent[],
  decision: Decision = makeDecision(),
): DecisionReplayInput {
  return { decision, events, currency: CURRENCY };
}

/** AAPL-style LONG decision: opened at 150 x10, target reached, closed at 170. */
function longTargetHitEvents(): DecisionEvent[] {
  return [
    makeEvent(DecisionEventType.DECISION_CREATED),
    makeEvent(DecisionEventType.THESIS_RECORDED, { thesis: "Breakout above resistance." }),
    makeEvent(DecisionEventType.POSITION_OPENED, { quantity: 10, price: 150 }),
    makeEvent(DecisionEventType.PRICE_UPDATE, { price: 160 }),
    makeEvent(DecisionEventType.TARGET_REACHED, { price: 170 }),
    makeEvent(DecisionEventType.POSITION_CLOSED, { price: 170 }),
  ];
}

describe("projectDecisionReplay", () => {
  it("should project a planned state before the first event", () => {
    const events = longTargetHitEvents();
    const state = projectDecisionReplay(makeInput(events), -1);

    expect(state.currentIndex).toBe(-1);
    expect(state.totalEvents).toBe(6);
    expect(state.currentEvent).toBeNull();
    expect(state.phase).toBe("PLANNED");
    expect(state.thesis).toBeNull();
    expect(state.riskLevel).toBe("MODERATE");
    expect(state.position).toBeNull();
    expect(state.lastPrice).toBeNull();
    expect(state.unrealizedPnL).toBeNull();
    expect(state.realizedPnL).toBeNull();
    expect(state.issues).toHaveLength(0);
  });

  it("should project an empty decision at index -1", () => {
    const state = projectDecisionReplay(makeInput([]), -1);

    expect(state.totalEvents).toBe(0);
    expect(state.phase).toBe("PLANNED");
  });

  it("should record the thesis when THESIS_RECORDED is reached", () => {
    const events = longTargetHitEvents();
    const state = projectDecisionReplay(makeInput(events), 1);

    expect(state.thesis).toBe("Breakout above resistance.");
    expect(state.currentEvent).toBe(events[1]);
  });

  it("should fall back to the decision thesis when the payload has none", () => {
    const events = [makeEvent(DecisionEventType.THESIS_RECORDED)];
    const state = projectDecisionReplay(makeInput(events), 0);

    expect(state.thesis).toBe("Price structure suggests continuation.");
  });

  it("should open the position and start at zero unrealized P/L", () => {
    const state = projectDecisionReplay(makeInput(longTargetHitEvents()), 2);

    expect(state.phase).toBe("OPEN");
    expect(state.position?.quantity).toBe(10);
    expect(state.position?.entryPrice.toString()).toBe("150");
    expect(state.lastPrice?.toString()).toBe("150");
    expect(state.unrealizedPnL?.isZero()).toBe(true);
  });

  it("should compute unrealized P/L from the last price", () => {
    const state = projectDecisionReplay(makeInput(longTargetHitEvents()), 3);

    expect(state.phase).toBe("OPEN");
    expect(state.lastPrice?.toString()).toBe("160");
    expect(state.unrealizedPnL?.toString()).toBe("100");
  });

  it("should realize P/L and clear the position when the decision closes on target", () => {
    const state = projectDecisionReplay(makeInput(longTargetHitEvents()), 5);

    expect(state.phase).toBe("CLOSED");
    expect(state.position).toBeNull();
    expect(state.unrealizedPnL).toBeNull();
    expect(state.realizedPnL?.toString()).toBe("200");
    expect(state.lastPrice?.toString()).toBe("170");
  });

  it("should realize a loss when a LONG decision closes at its stop", () => {
    const events = [
      makeEvent(DecisionEventType.POSITION_OPENED, { quantity: 10, price: 150 }),
      makeEvent(DecisionEventType.POSITION_CLOSED, { price: 140 }),
    ];
    const state = projectDecisionReplay(makeInput(events), 1);

    expect(state.phase).toBe("CLOSED");
    expect(state.realizedPnL?.toString()).toBe("-100");
  });

  it("should invert P/L for SHORT decisions", () => {
    const decision = makeDecision({ direction: DecisionDirection.SHORT });
    const events = [
      makeEvent(DecisionEventType.POSITION_OPENED, { quantity: 5, price: 100 }),
      makeEvent(DecisionEventType.PRICE_UPDATE, { price: 90 }),
      makeEvent(DecisionEventType.POSITION_CLOSED, { price: 110 }),
    ];

    const open = projectDecisionReplay(makeInput(events, decision), 1);
    expect(open.unrealizedPnL?.toString()).toBe("50");

    const closed = projectDecisionReplay(makeInput(events, decision), 2);
    expect(closed.realizedPnL?.toString()).toBe("-50");
  });

  it("should use a weighted-average entry price when the position is increased", () => {
    const events = [
      makeEvent(DecisionEventType.POSITION_OPENED, { quantity: 10, price: 100 }),
      makeEvent(DecisionEventType.POSITION_ADJUSTED, { quantity: 20, price: 130 }),
    ];
    const state = projectDecisionReplay(makeInput(events), 1);

    expect(state.position?.quantity).toBe(20);
    expect(state.position?.entryPrice.toString()).toBe("115");
    expect(state.lastPrice?.toString()).toBe("130");
    expect(state.unrealizedPnL?.toString()).toBe("300");
    expect(state.realizedPnL).toBeNull();
  });

  it("should realize the reduced part and keep the entry price when the position is reduced", () => {
    const events = [
      makeEvent(DecisionEventType.POSITION_OPENED, { quantity: 10, price: 100 }),
      makeEvent(DecisionEventType.POSITION_ADJUSTED, { quantity: 4, price: 120 }),
    ];
    const state = projectDecisionReplay(makeInput(events), 1);

    expect(state.position?.quantity).toBe(4);
    expect(state.position?.entryPrice.toString()).toBe("100");
    expect(state.realizedPnL?.toString()).toBe("120");
    expect(state.unrealizedPnL?.toString()).toBe("80");
  });

  it("should accumulate realized P/L across a reduction and the final close", () => {
    const events = [
      makeEvent(DecisionEventType.POSITION_OPENED, { quantity: 10, price: 100 }),
      makeEvent(DecisionEventType.POSITION_ADJUSTED, { quantity: 4, price: 120 }),
      makeEvent(DecisionEventType.POSITION_CLOSED, { price: 130 }),
    ];
    const state = projectDecisionReplay(makeInput(events), 2);

    // (120-100)*6 + (130-100)*4
    expect(state.realizedPnL?.toString()).toBe("240");
  });

  it("should avoid floating point error in fractional quantity deltas", () => {
    const events = [
      makeEvent(DecisionEventType.POSITION_OPENED, { quantity: 0.1, price: 100 }),
      makeEvent(DecisionEventType.POSITION_ADJUSTED, { quantity: 0.3, price: 100 }),
    ];
    const state = projectDecisionReplay(makeInput(events), 1);

    expect(state.position?.entryPrice.toString()).toBe("100");
  });

  it("should track risk level changes and notes as they happen", () => {
    const events = [
      makeEvent(DecisionEventType.RISK_CHANGED, { riskLevel: "HIGH" }),
      makeEvent(DecisionEventType.NOTE_ADDED, { note: "Earnings next week." }),
      makeEvent(DecisionEventType.NOTE_ADDED, { note: "Tightening stop." }),
    ];

    expect(projectDecisionReplay(makeInput(events), -1).riskLevel).toBe("MODERATE");
    expect(projectDecisionReplay(makeInput(events), 0).riskLevel).toBe("HIGH");
    expect(projectDecisionReplay(makeInput(events), 1).notes).toEqual(["Earnings next week."]);
    expect(projectDecisionReplay(makeInput(events), 2).notes).toEqual([
      "Earnings next week.",
      "Tightening stop.",
    ]);
  });

  it("should record a price update before any position as market context only", () => {
    const events = [makeEvent(DecisionEventType.PRICE_UPDATE, { price: 155 })];
    const state = projectDecisionReplay(makeInput(events), 0);

    expect(state.phase).toBe("PLANNED");
    expect(state.lastPrice?.toString()).toBe("155");
    expect(state.unrealizedPnL).toBeNull();
  });

  it("should ignore a malformed payload and report an issue without throwing", () => {
    const events = [
      makeEvent(DecisionEventType.PRICE_UPDATE, { price: "abc" }),
      makeEvent(DecisionEventType.NOTE_ADDED, { note: "   " }),
      makeEvent(DecisionEventType.POSITION_OPENED, { quantity: -5, price: 150 }),
    ];
    const state = projectDecisionReplay(makeInput(events), 2);

    expect(state.phase).toBe("PLANNED");
    expect(state.lastPrice).toBeNull();
    expect(state.notes).toHaveLength(0);
    expect(state.position).toBeNull();
    expect(state.issues).toHaveLength(3);
    expect(state.issues[0]?.eventType).toBe(DecisionEventType.PRICE_UPDATE);
    expect(state.issues[0]?.eventId).toBe(events[0]?.id);
  });

  it("should report an issue for out-of-sequence position events", () => {
    const events = [
      makeEvent(DecisionEventType.POSITION_CLOSED, { price: 160 }),
      makeEvent(DecisionEventType.POSITION_ADJUSTED, { quantity: 5, price: 160 }),
      makeEvent(DecisionEventType.POSITION_OPENED, { quantity: 10, price: 150 }),
      makeEvent(DecisionEventType.POSITION_OPENED, { quantity: 10, price: 155 }),
    ];
    const state = projectDecisionReplay(makeInput(events), 3);

    expect(state.phase).toBe("OPEN");
    expect(state.position?.entryPrice.toString()).toBe("150");
    expect(state.issues).toHaveLength(3);
  });

  it("should report an issue for an unsupported event type", () => {
    const unknown = {
      ...makeEvent(DecisionEventType.DECISION_CREATED),
      type: "SOMETHING_NEW" as DecisionEventType,
    };
    const state = projectDecisionReplay(makeInput([unknown]), 0);

    expect(state.issues).toHaveLength(1);
    expect(state.issues[0]?.message).toContain("SOMETHING_NEW");
  });

  it("should only report issues for events up to the current index", () => {
    const events = [
      makeEvent(DecisionEventType.DECISION_CREATED),
      makeEvent(DecisionEventType.PRICE_UPDATE, { price: "bad" }),
    ];

    expect(projectDecisionReplay(makeInput(events), 0).issues).toHaveLength(0);
    expect(projectDecisionReplay(makeInput(events), 1).issues).toHaveLength(1);
  });

  it("should not mutate its inputs and should be repeatable", () => {
    const decision = Object.freeze(makeDecision());
    const events = Object.freeze(
      longTargetHitEvents().map((event) =>
        Object.freeze({ ...event, payload: Object.freeze({ ...event.payload }) }),
      ),
    );
    const input = makeInput(events, decision);

    const first = projectDecisionReplay(input, 5);
    const second = projectDecisionReplay(input, 5);

    expect(second.realizedPnL?.toString()).toBe(first.realizedPnL?.toString());
    expect(second.phase).toBe(first.phase);
    expect(events).toHaveLength(6);
  });

  it("should allow scrubbing forwards and backwards deterministically", () => {
    const input = makeInput(longTargetHitEvents());

    const forward = projectDecisionReplay(input, 3);
    projectDecisionReplay(input, 5);
    const backward = projectDecisionReplay(input, 3);

    expect(backward.unrealizedPnL?.toString()).toBe(forward.unrealizedPnL?.toString());
    expect(backward.phase).toBe("OPEN");
  });

  it.each([-2, 6, 1.5, Number.NaN])("should reject out-of-range index %s", (index) => {
    const input = makeInput(longTargetHitEvents());

    expect(() => projectDecisionReplay(input, index)).toThrow(DecisionReplayError);
  });
});
