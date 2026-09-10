import type { Money } from "../value-objects/money";
import type { TransactionStatus } from "./enums";
import { TransactionType } from "./enums";

/**
 * Transaction entity.
 * Source: docs/05-data-model.md §9-10
 *
 * Represents a portfolio operation affecting holdings. References
 * Portfolio and Asset only through their IDs, keeping entities decoupled
 * (NFR-011, Domain Isolation).
 *
 * `price` and `fees` are `Money` (see §39, "Monetary Precision" and
 * 04-tech-stack.md §28.1). `quantity` remains a plain `number` — it is
 * a count of asset units, not a currency amount, so it is not subject
 * to the same precision-loss risk that motivated the `Money` type.
 *
 * There is no standalone `currency` field: the transaction's currency
 * is carried by `price.currency` (and `fees.currency`, which must match).
 */
export interface Transaction {
  readonly id: string;
  readonly portfolioId: string;
  readonly assetId: string;
  readonly type: TransactionType;
  readonly quantity: number;
  readonly price: Money;
  readonly fees: Money;
  readonly status: TransactionStatus;
  readonly executedAt: Date;
  readonly createdAt: Date;
}

export type CreateTransactionInput = Pick<
  Transaction,
  "portfolioId" | "assetId" | "type" | "quantity" | "price"
> &
  Partial<Pick<Transaction, "fees" | "executedAt">>;

export class InvalidTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTransactionError";
  }
}

/**
 * Domain invariants for Transaction creation.
 * Source: docs/02-functional-requirements.md FR-018.
 */
export function validateNewTransaction(input: CreateTransactionInput): void {
  if (!input.portfolioId || input.portfolioId.trim().length === 0) {
    throw new InvalidTransactionError("A transaction must belong to a portfolio.");
  }

  if (!input.assetId || input.assetId.trim().length === 0) {
    throw new InvalidTransactionError("A transaction must reference an asset.");
  }

  if (!Object.values(TransactionType).includes(input.type)) {
    throw new InvalidTransactionError(`Unsupported transaction type: ${input.type}`);
  }

  if (input.quantity <= 0) {
    throw new InvalidTransactionError("Quantity must be greater than zero.");
  }

  if (!input.price.isPositive()) {
    throw new InvalidTransactionError("Price must be greater than zero.");
  }

  if (input.fees !== undefined) {
    if (input.fees.isNegative()) {
      throw new InvalidTransactionError("Fees cannot be negative.");
    }

    if (input.fees.currency !== input.price.currency) {
      throw new InvalidTransactionError("Fees currency must match the transaction price currency.");
    }
  }

  if (input.executedAt !== undefined && input.executedAt > new Date()) {
    throw new InvalidTransactionError("Execution date cannot be in the future.");
  }
}
