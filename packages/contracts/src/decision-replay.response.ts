import { z } from "zod";
import { DecisionEventType } from "@trading/domain";
import type { Decision, DecisionEvent, DecisionReplayState } from "@trading/domain";
import { decisionResponseSchema, presentDecision } from "./decision.response.js";
import {
  isoTimestampSchema,
  moneySchema,
  presentMoney,
  presentTimestamp,
} from "./response-common.schema.js";

const decisionEventTypeValues = Object.values(DecisionEventType) as [
  DecisionEventType,
  ...DecisionEventType[],
];

/**
 * Response shape for GET /api/v1/decisions/:decisionId/replay.
 * Source: 07-api-spec.md §24, FR-034, domain `projectDecisionReplay`.
 *
 * Event payloads are free-form by design (05-data-model.md §12), so they
 * stay an open record here; the replay state around them is closed.
 */
export const decisionEventResponseSchema = z.object({
  id: z.string(),
  decisionId: z.string(),
  timestamp: isoTimestampSchema,
  type: z.enum(decisionEventTypeValues),
  payload: z.record(z.string(), z.unknown()),
});
export type DecisionEventResponse = z.infer<typeof decisionEventResponseSchema>;

export const decisionReplayStateResponseSchema = z.object({
  currentIndex: z.number().int(),
  totalEvents: z.number().int(),
  currentEvent: decisionEventResponseSchema.nullable(),
  phase: z.enum(["PLANNED", "OPEN", "CLOSED"]),
  thesis: z.string().nullable(),
  riskLevel: z.string().nullable(),
  notes: z.array(z.string()),
  position: z.object({ quantity: z.number(), entryPrice: moneySchema }).nullable(),
  lastPrice: moneySchema.nullable(),
  unrealizedPnL: moneySchema.nullable(),
  realizedPnL: moneySchema.nullable(),
  issues: z.array(
    z.object({
      eventId: z.string(),
      eventType: z.enum(decisionEventTypeValues),
      message: z.string(),
    }),
  ),
});
export type DecisionReplayStateResponse = z.infer<typeof decisionReplayStateResponseSchema>;

export const decisionReplayResponseSchema = z.object({
  decision: decisionResponseSchema,
  events: z.array(decisionEventResponseSchema),
  currency: z.string(),
  initialState: decisionReplayStateResponseSchema,
});
export type DecisionReplayResponse = z.infer<typeof decisionReplayResponseSchema>;

export function presentDecisionEvent(event: DecisionEvent): DecisionEventResponse {
  return {
    id: event.id,
    decisionId: event.decisionId,
    timestamp: presentTimestamp(event.timestamp),
    type: event.type,
    payload: { ...event.payload },
  };
}

export function presentDecisionReplayState(
  state: DecisionReplayState,
): DecisionReplayStateResponse {
  return {
    currentIndex: state.currentIndex,
    totalEvents: state.totalEvents,
    currentEvent: state.currentEvent ? presentDecisionEvent(state.currentEvent) : null,
    phase: state.phase,
    thesis: state.thesis,
    riskLevel: state.riskLevel,
    notes: [...state.notes],
    position: state.position
      ? { quantity: state.position.quantity, entryPrice: presentMoney(state.position.entryPrice) }
      : null,
    lastPrice: state.lastPrice ? presentMoney(state.lastPrice) : null,
    unrealizedPnL: state.unrealizedPnL ? presentMoney(state.unrealizedPnL) : null,
    realizedPnL: state.realizedPnL ? presentMoney(state.realizedPnL) : null,
    issues: state.issues.map((issue) => ({
      eventId: issue.eventId,
      eventType: issue.eventType,
      message: issue.message,
    })),
  };
}

export function presentDecisionReplay(replay: {
  decision: Decision;
  events: DecisionEvent[];
  currency: string;
  initialState: DecisionReplayState;
}): DecisionReplayResponse {
  return {
    decision: presentDecision(replay.decision),
    events: replay.events.map(presentDecisionEvent),
    currency: replay.currency,
    initialState: presentDecisionReplayState(replay.initialState),
  };
}
