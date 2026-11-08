import type { CreateMarketEventInput, MarketEvent, MarketEventRepository } from "@trading/domain";
import { prisma } from "../client.js";
import { toDomainMarketEvent, toPrismaCreateInput } from "../mappers/market-event-mapper.js";

/**
 * Prisma-backed implementation of `MarketEventRepository`.
 * No `update()`/`delete()` — append-only event log (see the domain
 * contract's module comment).
 */
export class PrismaMarketEventRepository implements MarketEventRepository {
  async listByAssetId(assetId: string, afterSequence?: number): Promise<MarketEvent[]> {
    const rows = await prisma.marketEvent.findMany({
      where: {
        assetId,
        ...(afterSequence !== undefined ? { sequence: { gt: BigInt(afterSequence) } } : {}),
      },
      orderBy: { sequence: "asc" },
    });
    return rows.map(toDomainMarketEvent);
  }

  async getLastSequence(assetId: string): Promise<number | null> {
    const row = await prisma.marketEvent.findFirst({
      where: { assetId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    return row ? Number(row.sequence) : null;
  }

  async create(input: CreateMarketEventInput): Promise<MarketEvent> {
    const row = await prisma.marketEvent.create({ data: toPrismaCreateInput(input) });
    return toDomainMarketEvent(row);
  }

  async pruneBeforeSequence(assetId: string, sequence: number): Promise<number> {
    const latest = await this.getLastSequence(assetId);
    if (latest === null) {
      return 0;
    }
    // Capped at the newest event, so the last sequence of the asset is never deleted.
    const below = Math.min(sequence, latest);
    const result = await prisma.marketEvent.deleteMany({
      where: { assetId, sequence: { lt: BigInt(below) } },
    });
    return result.count;
  }
}
