import { DecisionEventType } from "./enums";

/**
 * DecisionEvent entity.
 * Source: docs/05-data-model.md §12-13
 *
 * Represents one chronological event in a Decision's history. Decision
 * Replay derives its state by folding events[0..currentIndex] — this
 * file only defines the event shape and structural invariants. The
 * fold itself is the pure domain function `projectDecisionReplay`
 * (calculations/decision-replay.ts), which also documents the payload
 * conventions per event type. The `ReplayDecision` use case
 * (06-architecture.md §11) only loads data and calls it.
 */
export interface DecisionEvent {
  readonly id: string;
  readonly decisionId: string;
  readonly timestamp: Date;
  readonly type: DecisionEventType;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * `timestamp` is optional and defaults to "now" when omitted. Callers
 * recording historical activity (seed data, imports, demo scenarios)
 * pass the real event time so Decision Replay has a meaningful
 * timeline (05-data-model.md §12, §40). Events remain immutable once
 * created.
 */
export type CreateDecisionEventInput = Pick<DecisionEvent, "decisionId" | "type"> &
  Partial<Pick<DecisionEvent, "payload" | "timestamp">>;

export class InvalidDecisionEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDecisionEventError";
  }
}

export function validateNewDecisionEvent(input: CreateDecisionEventInput): void {
  if (!input.decisionId || input.decisionId.trim().length === 0) {
    throw new InvalidDecisionEventError("A decision event must reference a decision.");
  }

  if (!Object.values(DecisionEventType).includes(input.type)) {
    throw new InvalidDecisionEventError(`Unsupported decision event type: ${input.type}`);
  }

  if (input.timestamp !== undefined && Number.isNaN(input.timestamp.getTime())) {
    throw new InvalidDecisionEventError("Decision event timestamp must be a valid date.");
  }
}
