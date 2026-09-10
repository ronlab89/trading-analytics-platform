import type { Money } from "../value-objects/money";
import { DecisionDirection } from "./enums";

/**
 * Decision entity.
 * Source: docs/05-data-model.md §11
 *
 * Represents a trading decision and its contextual reasoning — "why a
 * trading action was considered or taken", not simply another
 * transaction record.
 *
 * `entryPrice`, `targetPrice` and `stopPrice` are `Money | null` (see
 * §39, "Monetary Precision" and 04-tech-stack.md §28.1). They are
 * nullable because a decision may exist before a price target/stop is
 * defined, or before it has been entered at all. Retrofitted for
 * consistency with `MarketEvent`/`MarketPrice`/`Position`/`Transaction`
 * (resolves open item 7.1 in PROGRESS.md) — a decision's target/stop
 * is directly compared against real market prices during Decision
 * Replay and Expected-vs-Actual (01-product-spec.md §14.2), so it is
 * not exempt from the same precision requirement.
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
  readonly entryPrice: Money | null;
  readonly targetPrice: Money | null;
  readonly stopPrice: Money | null;
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

/**
 * Validates a single optional price field: when present (and not
 * null), it must be a positive amount. Absent/null is always valid —
 * these fields are optional by design.
 */
function validateOptionalPrice(price: Money | null | undefined, fieldLabel: string): void {
  if (price === undefined || price === null) {
    return;
  }

  if (!price.isPositive()) {
    throw new InvalidDecisionError(`${fieldLabel} must be greater than zero.`);
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

  validateOptionalPrice(input.entryPrice, "Entry price");
  validateOptionalPrice(input.targetPrice, "Target price");
  validateOptionalPrice(input.stopPrice, "Stop price");

  const providedPrices = [input.entryPrice, input.targetPrice, input.stopPrice].filter(
    (price): price is Money => price !== undefined && price !== null,
  );

  if (providedPrices.length > 1) {
    const currency = providedPrices[0]?.currency;
    const hasMismatch = providedPrices.some((price) => price.currency !== currency);

    if (hasMismatch) {
      throw new InvalidDecisionError("Entry, target and stop prices must share the same currency.");
    }
  }
}
