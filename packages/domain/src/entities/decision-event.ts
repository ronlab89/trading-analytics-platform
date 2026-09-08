import { DecisionEventType } from "./enums";

/**
 * DecisionEvent entity.
 * Source: docs/05-data-model.md §12-13
 *
 * Represents one chronological event in a Decision's history. Decision
 * Replay derives its state by folding events[0..currentIndex] — this
 * file only defines the event shape and structural invariants; the
 * fold/replay logic itself belongs to the application layer
 * (06-architecture.md §11, "ReplayDecision" use case), not the domain
 * entity module.
 */
export interface DecisionEvent {
  readonly id: string;
  readonly decisionId: string;
  readonly timestamp: Date;
  readonly type: DecisionEventType;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type CreateDecisionEventInput = Pick<DecisionEvent, "decisionId" | "type"> &
  Partial<Pick<DecisionEvent, "payload">>;

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
}
