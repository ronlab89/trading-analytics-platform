import type { CreatePortfolioInput, Portfolio, PortfolioRepository } from "@trading/domain";
import { prisma } from "../client.js";
import { toDomainPortfolio, toPrismaCreateInput } from "../mappers/portfolio-mapper.js";

/**
 * Prisma-backed implementation of `PortfolioRepository`.
 * Source: docs/06-architecture.md §12 (Repository Pattern), §13 (Mock
 * Infrastructure — this is the "real adapter" side of that contract).
 *
 * This class contains no business rules. Domain invariants are the
 * caller's responsibility (see `validateNewPortfolio` in
 * packages/domain/src/entities/portfolio.ts) — this repository only
 * translates between the domain contract and Prisma's query API.
 */
export class PrismaPortfolioRepository implements PortfolioRepository {
  async listByUserId(userId: string): Promise<Portfolio[]> {
    const rows = await prisma.portfolio.findMany({ where: { userId } });
    return rows.map(toDomainPortfolio);
  }

  async getById(id: string): Promise<Portfolio | null> {
    const row = await prisma.portfolio.findUnique({ where: { id } });
    return row ? toDomainPortfolio(row) : null;
  }

  async create(input: CreatePortfolioInput): Promise<Portfolio> {
    const row = await prisma.portfolio.create({ data: toPrismaCreateInput(input) });
    return toDomainPortfolio(row);
  }

  async update(
    id: string,
    input: Partial<Pick<Portfolio, "name" | "description" | "baseCurrency" | "status">>,
  ): Promise<Portfolio> {
    const row = await prisma.portfolio.update({ where: { id }, data: input });
    return toDomainPortfolio(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.portfolio.delete({ where: { id } });
  }
}
