import type { Transaction as PrismaTransaction } from "../../generated/client/index.js";
import type {
  CreateTransactionInput,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@trading/domain";
import { Money } from "@trading/domain";

/** Same enum-bridging rationale as the other mappers in this package. */
function toDomainType(type: PrismaTransaction["type"]): TransactionType {
  return type;
}

function toDomainStatus(status: PrismaTransaction["status"]): TransactionStatus {
  return status;
}

/**
 * Converts Prisma's `Decimal` amount + the row's shared `currency`
 * column into a domain `Money` value object.
 *
 * `.toString()` on Prisma's Decimal preserves full precision as text,
 * which `Money.of()` then parses back into its own decimal.js instance
 * — this avoids ever round-tripping the amount through a JS `number`
 * (see 05-data-model.md §39, Monetary Precision).
 */
function toMoney(amount: PrismaTransaction["price"], currency: string): Money {
  return Money.of(amount.toString(), currency);
}

export function toDomainTransaction(row: PrismaTransaction): Transaction {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    assetId: row.assetId,
    type: toDomainType(row.type),
    quantity: row.quantity.toNumber(),
    price: toMoney(row.price, row.currency),
    fees: toMoney(row.fees, row.currency),
    status: toDomainStatus(row.status),
    executedAt: row.executedAt,
    createdAt: row.createdAt,
  };
}

/**
 * `executedAt` defaults to "now" when the caller omits it — see
 * PROGRESS.md decision log: the domain contract allows omitting it,
 * but the database column has no default, so this repository is the
 * layer responsible for filling that gap.
 *
 * `currency` is a single shared column (schema.prisma), derived from
 * `price.currency` — the domain layer (`validateNewTransaction`) already
 * guarantees `fees.currency === price.currency` before this is called.
 *
 * `status` is intentionally never accepted here: `CreateTransactionInput`
 * has no `status` field (see entities/transaction.ts) — every transaction
 * is created in the database's default `DRAFT` state and transitions
 * only through `updateStatus()`.
 */
export function toPrismaCreateInput(input: CreateTransactionInput) {
  return {
    portfolioId: input.portfolioId,
    assetId: input.assetId,
    type: input.type,
    quantity: input.quantity,
    price: input.price.toString(),
    currency: input.price.currency,
    executedAt: input.executedAt ?? new Date(),
    ...(input.fees !== undefined ? { fees: input.fees.toString() } : {}),
  };
}
