import type { PortfolioStatus } from "./enums";

/**
 * Portfolio entity.
 * Source: docs/05-data-model.md §6
 *
 * Represents a logical collection of trading activity and positions,
 * owned by exactly one user. This entity only references the owner
 * through `userId` — it does not import the User type, keeping the
 * two entities decoupled (NFR-011, Domain Isolation).
 */
export interface Portfolio {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description: string | null;
  readonly baseCurrency: string;
  readonly status: PortfolioStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type CreatePortfolioInput = Pick<Portfolio, "userId" | "name" | "baseCurrency"> &
  Partial<Pick<Portfolio, "description" | "status">>;

export class InvalidPortfolioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPortfolioError";
  }
}

/**
 * Minimal check for a 3-letter ISO 4217-style currency code.
 *
 * This does not validate against the real ISO 4217 list — it only
 * rejects obviously malformed input at the domain boundary (NFR-021).
 */
function isValidCurrencyFormat(currency: string): boolean {
  return currency.length === 3 && currency === currency.toUpperCase();
}

/**
 * Domain invariants for Portfolio creation.
 */
export function validateNewPortfolio(input: CreatePortfolioInput): void {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new InvalidPortfolioError("A portfolio must belong to a user.");
  }

  if (!input.name || input.name.trim().length === 0) {
    throw new InvalidPortfolioError("Portfolio name is required.");
  }

  if (!input.baseCurrency || !isValidCurrencyFormat(input.baseCurrency)) {
    throw new InvalidPortfolioError("Base currency must be a 3-letter uppercase currency code.");
  }
}
