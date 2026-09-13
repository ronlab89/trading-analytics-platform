import type { Position as PrismaPosition } from "../../generated/client/index.js";
import type { CreatePositionInput, Position } from "@trading/domain";
import { Money } from "@trading/domain";

/**
 * Same rationale as toMoney in transaction-mapper.ts: converts a Prisma
 * `Decimal` plus the row's shared `currency` column into a domain
 * `Money`, round-tripping through a string to avoid ever passing through
 * a lossy JS `number`.
 */
function toMoney(amount: PrismaPosition["averageEntryPrice"], currency: string): Money {
  return Money.of(amount.toString(), currency);
}

export function toDomainPosition(row: PrismaPosition): Position {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    assetId: row.assetId,
    quantity: row.quantity.toNumber(),
    averageEntryPrice: toMoney(row.averageEntryPrice, row.currency),
    currentPrice: toMoney(row.currentPrice, row.currency),
    openedAt: row.openedAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * `currency` is a single shared column (schema.prisma, added in the
 * add_currency_to_position migration) derived from
 * `averageEntryPrice.currency` — `validateNewPosition` already
 * guarantees `averageEntryPrice.currency === currentPrice.currency`
 * before this is called.
 *
 * Split into `create`/`update` payloads (rather than one shared object)
 * because `openedAt` must only ever be set once, when the position is
 * first opened — an upsert that re-runs `create`'s data on every
 * subsequent update would silently reset "when this position was
 * opened" every time a new transaction touches an already-open position.
 */
export function toPrismaUpsertCreateData(input: CreatePositionInput) {
  return {
    quantity: input.quantity,
    currency: input.averageEntryPrice.currency,
    averageEntryPrice: input.averageEntryPrice.toString(),
    currentPrice: input.currentPrice.toString(),
    openedAt: new Date(),
  };
}

export function toPrismaUpsertUpdateData(input: CreatePositionInput) {
  return {
    quantity: input.quantity,
    currency: input.averageEntryPrice.currency,
    averageEntryPrice: input.averageEntryPrice.toString(),
    currentPrice: input.currentPrice.toString(),
  };
}
