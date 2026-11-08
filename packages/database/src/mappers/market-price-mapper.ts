import type { MarketPrice as PrismaMarketPrice } from "../../generated/client/index.js";
import type { CreateMarketPriceInput, MarketDataSource, MarketPrice } from "@trading/domain";
import { Money } from "@trading/domain";

function toDomainSource(source: PrismaMarketPrice["source"]): MarketDataSource {
  return source;
}

function toMoney(amount: PrismaMarketPrice["price"], currency: string): Money {
  return Money.of(amount.toString(), currency);
}

export function toDomainMarketPrice(row: PrismaMarketPrice): MarketPrice {
  return {
    assetId: row.assetId,
    price: toMoney(row.price, row.currency),
    previousPrice: toMoney(row.previousPrice, row.currency),
    change: toMoney(row.change, row.currency),
    changePercent: row.changePercent,
    timestamp: row.timestamp,
    source: toDomainSource(row.source),
  };
}

/**
 * `currency` is a single shared column (schema.prisma, added in the
 * add_currency_to_market_price_and_historical_price migration) derived
 * from `price.currency` — `validateNewMarketPrice` already guarantees
 * `previousPrice.currency === change.currency === price.currency`.
 */
export function toPrismaUpsertData(input: CreateMarketPriceInput) {
  return {
    price: input.price.toString(),
    currency: input.price.currency,
    previousPrice: input.previousPrice.toString(),
    change: input.change.toString(),
    changePercent: input.changePercent,
    timestamp: input.timestamp,
    source: input.source,
  };
}
