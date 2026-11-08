import type { HistoricalPrice as PrismaHistoricalPrice } from "../../generated/client/index.js";
import type { CreateHistoricalPriceInput, HistoricalPrice } from "@trading/domain";
import { Money } from "@trading/domain";

function toMoney(amount: PrismaHistoricalPrice["open"], currency: string): Money {
  return Money.of(amount.toString(), currency);
}

export function toDomainHistoricalPrice(row: PrismaHistoricalPrice): HistoricalPrice {
  return {
    assetId: row.assetId,
    timestamp: row.timestamp,
    open: toMoney(row.open, row.currency),
    high: toMoney(row.high, row.currency),
    low: toMoney(row.low, row.currency),
    close: toMoney(row.close, row.currency),
    volume: row.volume.toNumber(),
  };
}

/**
 * `currency` is a single shared column (schema.prisma, added in the
 * add_currency_to_market_price_and_historical_price migration) derived
 * from `open.currency` — `validateNewHistoricalPrice` already
 * guarantees all four OHLC fields share the same currency.
 *
 * `timestamp` defaults to `new Date()` when omitted — same rationale as
 * Transaction.executedAt: `CreateHistoricalPriceInput` allows omitting
 * it, but it is part of the composite primary key
 * (@@id([assetId, timestamp])) and has no database default.
 */
export function toPrismaCreateInput(input: CreateHistoricalPriceInput) {
  return {
    assetId: input.assetId,
    timestamp: input.timestamp ?? new Date(),
    currency: input.open.currency,
    open: input.open.toString(),
    high: input.high.toString(),
    low: input.low.toString(),
    close: input.close.toString(),
    volume: input.volume,
  };
}
