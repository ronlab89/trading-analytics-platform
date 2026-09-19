import type {
  CreateTransactionInput,
  Transaction,
  TransactionRepository,
  TransactionStatus,
  TransactionType,
} from "@trading/domain";
import type { Prisma } from "../../generated/client/index.js";
import { prisma } from "../client.js";
import { toDomainTransaction, toPrismaCreateInput } from "../mappers/transaction-mapper.js";

/**
 * Prisma-backed implementation of `TransactionRepository`.
 * See prisma-portfolio-repository.ts for the shared rationale, and
 * transaction-repository.ts (domain) for why this contract has no
 * generic `update()`/`delete()` — a transaction is a historical fact
 * once recorded; only its processing status may change.
 */
export class PrismaTransactionRepository implements TransactionRepository {
  async listByPortfolioId(
    portfolioId: string,
    filter?: { assetId?: string; type?: TransactionType; dateFrom?: Date; dateTo?: Date },
  ): Promise<Transaction[]> {
    const where: Prisma.TransactionWhereInput = {
      portfolioId,
      ...(filter?.assetId !== undefined ? { assetId: filter.assetId } : {}),
      ...(filter?.type !== undefined ? { type: filter.type } : {}),
      ...(filter?.dateFrom !== undefined || filter?.dateTo !== undefined
        ? {
            executedAt: {
              ...(filter.dateFrom !== undefined ? { gte: filter.dateFrom } : {}),
              ...(filter.dateTo !== undefined ? { lte: filter.dateTo } : {}),
            },
          }
        : {}),
    };

    const rows = await prisma.transaction.findMany({ where, orderBy: { executedAt: "desc" } });
    return rows.map(toDomainTransaction);
  }

  async getById(id: string): Promise<Transaction | null> {
    const row = await prisma.transaction.findUnique({ where: { id } });
    return row ? toDomainTransaction(row) : null;
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const row = await prisma.transaction.create({ data: toPrismaCreateInput(input) });
    return toDomainTransaction(row);
  }

  async updateStatus(id: string, status: TransactionStatus): Promise<Transaction> {
    const row = await prisma.transaction.update({ where: { id }, data: { status } });
    return toDomainTransaction(row);
  }
}
