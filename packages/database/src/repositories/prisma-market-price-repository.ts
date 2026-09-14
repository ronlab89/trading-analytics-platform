import type { CreateMarketPriceInput, MarketPrice, MarketPriceRepository } from "@trading/domain";
import { prisma } from "../client.js";
import { toDomainMarketPrice, toPrismaUpsertData } from "../mappers/market-price-mapper.js";

export class PrismaMarketPriceRepository implements MarketPriceRepository {
  async getByAssetId(assetId: string): Promise<MarketPrice | null> {
    const row = await prisma.marketPrice.findUnique({ where: { assetId } });
    return row ? toDomainMarketPrice(row) : null;
  }

  async listByAssetIds(assetIds: string[]): Promise<MarketPrice[]> {
    const rows = await prisma.marketPrice.findMany({ where: { assetId: { in: assetIds } } });
    return rows.map(toDomainMarketPrice);
  }

  async upsert(input: CreateMarketPriceInput): Promise<MarketPrice> {
    const data = toPrismaUpsertData(input);
    const row = await prisma.marketPrice.upsert({
      where: { assetId: input.assetId },
      create: { assetId: input.assetId, ...data },
      update: data,
    });
    return toDomainMarketPrice(row);
  }
}
