import type { Alert, AlertRepository, AlertUpdate, CreateAlertInput } from "@trading/domain";
import { prisma, type DatabaseClient } from "../client.js";
import { toDomainAlert, toPrismaCreateInput } from "../mappers/alert-mapper.js";

/**
 * Prisma-backed implementation of `AlertRepository`.
 *
 * Accepts an optional client so it can join a Unit of Work
 * (see prisma-unit-of-work.ts); defaults to the shared client.
 */
export class PrismaAlertRepository implements AlertRepository {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient = prisma) {
    this.db = db;
  }

  async listByUserId(userId: string): Promise<Alert[]> {
    const rows = await this.db.alert.findMany({ where: { userId } });
    return rows.map(toDomainAlert);
  }

  async getById(id: string): Promise<Alert | null> {
    const row = await this.db.alert.findUnique({ where: { id } });
    return row ? toDomainAlert(row) : null;
  }

  async listEnabledByAssetIds(assetIds: readonly string[]): Promise<Alert[]> {
    if (assetIds.length === 0) {
      return [];
    }
    const rows = await this.db.alert.findMany({
      where: { enabled: true, assetId: { in: [...assetIds] } },
    });
    return rows.map(toDomainAlert);
  }

  async create(input: CreateAlertInput): Promise<Alert> {
    const row = await this.db.alert.create({ data: toPrismaCreateInput(input) });
    return toDomainAlert(row);
  }

  async update(id: string, input: AlertUpdate): Promise<Alert> {
    const row = await this.db.alert.update({ where: { id }, data: input });
    return toDomainAlert(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.alert.delete({ where: { id } });
  }
}
