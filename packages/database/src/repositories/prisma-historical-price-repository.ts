import type {
  CreateHistoricalPriceInput,
  HistoricalPrice,
  HistoricalPriceRepository,
} from "@trading/domain";
import { prisma } from "../client.js";
import {
  toDomainHistoricalPrice,
  toPrismaCreateInput,
} from "../mappers/historical-price-mapper.js";

/**
 * Prisma-backed implementation of `HistoricalPriceRepository`.
 *
 * `create()` uses Prisma's `upsert` internally, keyed by the composite
 * (assetId, timestamp) primary key, per the contract's own module
 * comment: "replaying the same candle should not create a duplicate
 * row." A plain `create()` would throw on the second call for the same
 * candle; `upsert` makes replay a safe no-op-equivalent overwrite
 * instead, without changing this repository's public method name.
 */
export class PrismaHistoricalPriceRepository implements HistoricalPriceRepository {
  async listByAssetId(assetId: string, from: Date, to: Date): Promise<HistoricalPrice[]> {
    const rows = await prisma.historicalPrice.findMany({
      where: { assetId, timestamp: { gte: from, lte: to } },
      orderBy: { timestamp: "asc" },
    });
    return rows.map(toDomainHistoricalPrice);
  }

  async create(input: CreateHistoricalPriceInput): Promise<HistoricalPrice> {
    const data = toPrismaCreateInput(input);
    const row = await prisma.historicalPrice.upsert({
      where: { assetId_timestamp: { assetId: data.assetId, timestamp: data.timestamp } },
      create: data,
      update: data,
    });
    return toDomainHistoricalPrice(row);
  }
}
