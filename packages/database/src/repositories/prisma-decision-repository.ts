import type {
  CreateDecisionInput,
  Decision,
  DecisionDirection,
  DecisionRepository,
} from "@trading/domain";
import type { Prisma } from "../../generated/client/index.js";
import { prisma } from "../client.js";
import { toDomainDecision, toPrismaCreateInput } from "../mappers/decision-mapper.js";

export class PrismaDecisionRepository implements DecisionRepository {
  async listByPortfolioId(
    portfolioId: string,
    filter?: { assetId?: string; direction?: DecisionDirection; dateFrom?: Date; dateTo?: Date },
  ): Promise<Decision[]> {
    const where: Prisma.DecisionWhereInput = {
      portfolioId,
      ...(filter?.assetId !== undefined ? { assetId: filter.assetId } : {}),
      ...(filter?.direction !== undefined ? { direction: filter.direction } : {}),
      ...(filter?.dateFrom !== undefined || filter?.dateTo !== undefined
        ? {
            createdAt: {
              ...(filter.dateFrom !== undefined ? { gte: filter.dateFrom } : {}),
              ...(filter.dateTo !== undefined ? { lte: filter.dateTo } : {}),
            },
          }
        : {}),
    };

    const rows = await prisma.decision.findMany({ where, orderBy: { createdAt: "desc" } });
    return rows.map(toDomainDecision);
  }

  async getById(id: string): Promise<Decision | null> {
    const row = await prisma.decision.findUnique({ where: { id } });
    return row ? toDomainDecision(row) : null;
  }

  async create(input: CreateDecisionInput): Promise<Decision> {
    const row = await prisma.decision.create({ data: toPrismaCreateInput(input) });
    return toDomainDecision(row);
  }

  /**
   * `targetPrice`/`stopPrice` share one `currency` column with
   * `entryPrice` (schema.prisma). When either is updated, the shared
   * column is updated to match — keeping the three prices in a mutually
   * consistent currency across partial updates is an application-layer
   * concern (see docs/09-security-spec.md-style validation boundary
   * reasoning applied elsewhere), not enforced by this repository.
   */
  async update(
    id: string,
    input: Partial<
      Pick<Decision, "title" | "thesis" | "targetPrice" | "stopPrice" | "riskLevel" | "notes">
    >,
  ): Promise<Decision> {
    const { targetPrice, stopPrice, ...rest } = input;
    const sharedCurrency = targetPrice?.currency ?? stopPrice?.currency;

    const row = await prisma.decision.update({
      where: { id },
      data: {
        ...rest,
        ...(targetPrice !== undefined ? { targetPrice: targetPrice?.toString() ?? null } : {}),
        ...(stopPrice !== undefined ? { stopPrice: stopPrice?.toString() ?? null } : {}),
        ...(sharedCurrency !== undefined ? { currency: sharedCurrency } : {}),
      },
    });
    return toDomainDecision(row);
  }

  async close(id: string, outcome: string, closedAt: Date): Promise<Decision> {
    const row = await prisma.decision.update({ where: { id }, data: { outcome, closedAt } });
    return toDomainDecision(row);
  }
}
