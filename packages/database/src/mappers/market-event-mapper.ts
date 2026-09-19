import type { MarketEvent as PrismaMarketEvent } from "../../generated/client/index.js";
import type { CreateMarketEventInput, MarketEvent } from "@trading/domain";
import { Money } from "@trading/domain";

export function toDomainMarketEvent(row: PrismaMarketEvent): MarketEvent {
  return {
    id: row.id,
    assetId: row.assetId,
    price: Money.of(row.price.toString(), row.currency),
    timestamp: row.timestamp,
    // Schema stores sequence as BigInt (unbounded), domain uses a plain
    // number (validated as a non-negative integer — see
    // validateNewMarketEvent). Converting to Number is safe within the
    // range this system will realistically ever reach for a single
    // asset's tick counter; it is not safe for arbitrary BigInt values
    // in general, which is an accepted, documented trade-off here.
    sequence: Number(row.sequence),
  };
}

export function toPrismaCreateInput(input: CreateMarketEventInput) {
  return {
    assetId: input.assetId,
    price: input.price.toString(),
    currency: input.price.currency,
    timestamp: new Date(),
    sequence: BigInt(input.sequence),
  };
}
