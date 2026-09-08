import { TransactionType } from "./enums";
import type { TransactionStatus } from "./enums";

/**
 * Transaction entity.
 * Source: docs/05-data-model.md §9-10
 *
 * Represents a portfolio operation affecting holdings. References
 * Portfolio and Asset only through their IDs, keeping entities decoupled
 * (NFR-011, Domain Isolation).
 *
 * Monetary fields (`quantity`, `price`, `fees`) use `number` at this stage.
 * The final safe-precision representation (e.g. decimal string, integer
 * minor units) is an implementation decision deferred to persistence/API
 * work, per §39 ("Monetary Precision") — introducing it now would be
 * premature for a pure type + invariant definition (NFR-070).
 */
export interface Transaction {
  readonly id: string;
  readonly portfolioId: string;
  readonly assetId: string;
  readonly type: TransactionType;
  readonly quantity: number;
  readonly price: number;
  readonly fees: number;
  readonly currency: string;
  readonly status: TransactionStatus;
  readonly executedAt: Date;
  readonly createdAt: Date;
}

export type CreateTransactionInput = Pick<
  Transaction,
  "portfolioId" | "assetId" | "type" | "quantity" | "price" | "currency"
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

  if (input.price <= 0) {
    throw new InvalidTransactionError("Price must be greater than zero.");
  }

  if (input.fees !== undefined && input.fees < 0) {
    throw new InvalidTransactionError("Fees cannot be negative.");
  }

  if (!input.currency || input.currency.trim().length === 0) {
    throw new InvalidTransactionError("Currency is required.");
  }

  if (input.executedAt !== undefined && input.executedAt > new Date()) {
    throw new InvalidTransactionError("Execution date cannot be in the future.");
  }
}
