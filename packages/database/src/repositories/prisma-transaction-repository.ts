import type {
  CreateTransactionInput,
  Transaction,
  TransactionRepository,
  TransactionStatus,
  TransactionType,
} from "@trading/domain";
import type { Prisma } from "../../generated/client/index.js";
import { prisma, type DatabaseClient } from "../client.js";
import { toDomainTransaction, toPrismaCreateInput } from "../mappers/transaction-mapper.js";

/**
 * Prisma-backed implementation of `TransactionRepository`.
 * See prisma-portfolio-repository.ts for the shared rationale, and
 * transaction-repository.ts (domain) for why this contract has no
 * generic `update()`/`delete()` — a transaction is a historical fact
 * once recorded; only its processing status may change.
 *
 * Accepts an optional client so it can join a Unit of Work
 * (see prisma-unit-of-work.ts); defaults to the shared client.
 */
export class PrismaTransactionRepository implements TransactionRepository {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient = prisma) {
    this.db = db;
  }

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

    const rows = await this.db.transaction.findMany({ where, orderBy: { executedAt: "desc" } });
    return rows.map(toDomainTransaction);
  }

  async getById(id: string): Promise<Transaction | null> {
    const row = await this.db.transaction.findUnique({ where: { id } });
    return row ? toDomainTransaction(row) : null;
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const row = await this.db.transaction.create({ data: toPrismaCreateInput(input) });
    return toDomainTransaction(row);
  }

  async updateStatus(id: string, status: TransactionStatus): Promise<Transaction> {
    const row = await this.db.transaction.update({ where: { id }, data: { status } });
    return toDomainTransaction(row);
  }
}
