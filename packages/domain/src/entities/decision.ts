import { DecisionDirection } from "./enums";

/**
 * Decision entity.
 * Source: docs/05-data-model.md §11
 *
 * Represents a trading decision and its contextual reasoning — "why a
 * trading action was considered or taken", not simply another
 * transaction record.
 *
 * `riskLevel` and `outcome` are intentionally free-form strings: the
 * data model does not enumerate their possible values here (unlike
 * `direction`, which has an explicit LONG/SHORT/NEUTRAL list).
 * `outcome` is nullable because it is only meaningful once a decision
 * has been closed.
 */
export interface Decision {
  readonly id: string;
  readonly portfolioId: string;
  readonly assetId: string;
  readonly title: string;
  readonly thesis: string;
  readonly direction: DecisionDirection;
  readonly entryPrice: number | null;
  readonly targetPrice: number | null;
  readonly stopPrice: number | null;
  readonly riskLevel: string | null;
  readonly createdAt: Date;
  readonly closedAt: Date | null;
  readonly outcome: string | null;
  readonly notes: string | null;
}

export type CreateDecisionInput = Pick<
  Decision,
  "portfolioId" | "assetId" | "title" | "thesis" | "direction"
> &
  Partial<Pick<Decision, "entryPrice" | "targetPrice" | "stopPrice" | "riskLevel" | "notes">>;

export class InvalidDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDecisionError";
  }
}

export function validateNewDecision(input: CreateDecisionInput): void {
  if (!input.portfolioId || input.portfolioId.trim().length === 0) {
    throw new InvalidDecisionError("A decision must belong to a portfolio.");
  }

  if (!input.assetId || input.assetId.trim().length === 0) {
    throw new InvalidDecisionError("A decision must reference an asset.");
  }

  if (!input.title || input.title.trim().length === 0) {
    throw new InvalidDecisionError("Decision title is required.");
  }

  if (!input.thesis || input.thesis.trim().length === 0) {
    throw new InvalidDecisionError("Decision thesis is required.");
  }

  if (!Object.values(DecisionDirection).includes(input.direction)) {
    throw new InvalidDecisionError(`Unsupported decision direction: ${input.direction}`);
  }

  if (input.entryPrice !== undefined && input.entryPrice !== null && input.entryPrice <= 0) {
    throw new InvalidDecisionError("Entry price must be greater than zero.");
  }
}
