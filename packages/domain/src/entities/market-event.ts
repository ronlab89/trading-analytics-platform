import type { Money } from "../value-objects/money";

/**
 * MarketEvent entity.
 * Source: docs/05-data-model.md §19
 *
 * Represents a price update event. `sequence` supports deterministic
 * ordering so stale events can be detected and ignored, per §44
 * ("Event Ordering") and 07-realtime-spec.md.
 *
 * `price` is `Money` (see §39, "Monetary Precision" and
 * 04-tech-stack.md §28.1), for consistency with `MarketPrice` and
 * `Position` — a market event's price ultimately feeds authoritative
 * position/portfolio calculations, so it is not exempt from the same
 * precision requirement (resolves open item 7.1 in PROGRESS.md).
 */
export interface MarketEvent {
  readonly id: string;
  readonly assetId: string;
  readonly price: Money;
  readonly timestamp: Date;
  readonly sequence: number;
}

export type CreateMarketEventInput = Pick<MarketEvent, "assetId" | "price" | "sequence">;

export class InvalidMarketEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMarketEventError";
  }
}

export function validateNewMarketEvent(input: CreateMarketEventInput): void {
  if (!input.assetId || input.assetId.trim().length === 0) {
    throw new InvalidMarketEventError("A market event must reference an asset.");
  }

  if (!input.price.isPositive()) {
    throw new InvalidMarketEventError("Price must be greater than zero.");
  }

  if (!Number.isInteger(input.sequence) || input.sequence < 0) {
    throw new InvalidMarketEventError("Sequence must be a non-negative integer.");
  }
}

/**
 * Determines whether an incoming event is stale relative to the last
 * processed sequence number, per §44 and 07-realtime-spec.md §24.
 *
 * This is a pure ordering rule intrinsic to the event's own sequence
 * field — not a cross-entity analytics calculation — so it is kept
 * here rather than deferred to the future domain-calculations module.
 */
export function isStaleMarketEvent(
  incomingSequence: number,
  lastProcessedSequence: number,
): boolean {
  return incomingSequence <= lastProcessedSequence;
}
