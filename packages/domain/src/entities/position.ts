import type { Money } from "../value-objects/money";

/**
 * Position entity.
 * Source: docs/05-data-model.md §8
 *
 * Represents the current exposure of a portfolio to an asset.
 *
 * IMPORTANT: Position state is conceptually derived from transaction
 * history and current market data (§8 — "The application should avoid
 * treating manually entered position totals as the authoritative source
 * when they can be calculated"). This file only defines the shape and
 * structural invariants of a Position record. The actual derivation
 * logic (calculatePositionMetrics) belongs to a dedicated domain
 * calculations module, per 06-architecture.md §10, and is intentionally
 * out of scope here.
 *
 * `averageEntryPrice` and `currentPrice` are `Money` (see §39, "Monetary
 * Precision" and 04-tech-stack.md §28.1). `quantity` remains a plain
 * `number` — it is a count of asset units, not a currency amount.
 *
 * There is no standalone `currency` field: a position's currency is
 * carried by `averageEntryPrice.currency` (and `currentPrice.currency`,
 * which must match — a position cannot be valued in two currencies at
 * once).
 */
export interface Position {
  readonly id: string;
  readonly portfolioId: string;
  readonly assetId: string;
  readonly quantity: number;
  readonly averageEntryPrice: Money;
  readonly currentPrice: Money;
  readonly openedAt: Date;
  readonly updatedAt: Date;
}

export type CreatePositionInput = Pick<
  Position,
  "portfolioId" | "assetId" | "quantity" | "averageEntryPrice" | "currentPrice"
>;

export class InvalidPositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPositionError";
  }
}

/**
 * Structural invariants for a Position record.
 *
 * These do not encode "how a position is calculated" — only what makes
 * a Position record internally valid regardless of its origin.
 */
export function validateNewPosition(input: CreatePositionInput): void {
  if (!input.portfolioId || input.portfolioId.trim().length === 0) {
    throw new InvalidPositionError("A position must belong to a portfolio.");
  }

  if (!input.assetId || input.assetId.trim().length === 0) {
    throw new InvalidPositionError("A position must reference an asset.");
  }

  if (input.quantity <= 0) {
    throw new InvalidPositionError("Quantity must be greater than zero.");
  }

  if (!input.averageEntryPrice.isPositive()) {
    throw new InvalidPositionError("Average entry price must be greater than zero.");
  }

  if (!input.currentPrice.isPositive()) {
    throw new InvalidPositionError("Current price must be greater than zero.");
  }

  if (input.averageEntryPrice.currency !== input.currentPrice.currency) {
    throw new InvalidPositionError(
      "Current price currency must match the average entry price currency.",
    );
  }
}
