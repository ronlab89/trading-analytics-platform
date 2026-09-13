import type { CreatePositionInput, Money, Position, PositionRepository } from "@trading/domain";
import { prisma } from "../client.js";
import {
  toDomainPosition,
  toPrismaUpsertCreateData,
  toPrismaUpsertUpdateData,
} from "../mappers/position-mapper.js";

/**
 * Prisma-backed implementation of `PositionRepository`.
 * See prisma-portfolio-repository.ts for the shared rationale, and
 * position-repository.ts (domain) for why this contract has `upsert()`
 * and `updateCurrentPrice()` instead of a generic `update()`.
 */
export class PrismaPositionRepository implements PositionRepository {
  async listByPortfolioId(portfolioId: string): Promise<Position[]> {
    const rows = await prisma.position.findMany({ where: { portfolioId } });
    return rows.map(toDomainPosition);
  }

  async getById(id: string): Promise<Position | null> {
    const row = await prisma.position.findUnique({ where: { id } });
    return row ? toDomainPosition(row) : null;
  }

  async getByPortfolioAndAsset(portfolioId: string, assetId: string): Promise<Position | null> {
    const row = await prisma.position.findUnique({
      where: { portfolioId_assetId: { portfolioId, assetId } },
    });
    return row ? toDomainPosition(row) : null;
  }

  async upsert(input: CreatePositionInput): Promise<Position> {
    const row = await prisma.position.upsert({
      where: { portfolioId_assetId: { portfolioId: input.portfolioId, assetId: input.assetId } },
      create: {
        portfolioId: input.portfolioId,
        assetId: input.assetId,
        ...toPrismaUpsertCreateData(input),
      },
      update: toPrismaUpsertUpdateData(input),
    });
    return toDomainPosition(row);
  }

  async updateCurrentPrice(id: string, currentPrice: Money): Promise<Position> {
    const row = await prisma.position.update({
      where: { id },
      data: { currentPrice: currentPrice.toString() },
    });
    return toDomainPosition(row);
  }

  async deleteByPortfolioAndAsset(portfolioId: string, assetId: string): Promise<void> {
    await prisma.position.delete({
      where: { portfolioId_assetId: { portfolioId, assetId } },
    });
  }
}
