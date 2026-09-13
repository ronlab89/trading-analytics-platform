import type { Alert, AlertRepository, CreateAlertInput } from "@trading/domain";
import { prisma } from "../client.js";
import { toDomainAlert, toPrismaCreateInput } from "../mappers/alert-mapper.js";

export class PrismaAlertRepository implements AlertRepository {
  async listByUserId(userId: string): Promise<Alert[]> {
    const rows = await prisma.alert.findMany({ where: { userId } });
    return rows.map(toDomainAlert);
  }

  async getById(id: string): Promise<Alert | null> {
    const row = await prisma.alert.findUnique({ where: { id } });
    return row ? toDomainAlert(row) : null;
  }

  async create(input: CreateAlertInput): Promise<Alert> {
    const row = await prisma.alert.create({ data: toPrismaCreateInput(input) });
    return toDomainAlert(row);
  }

  async update(
    id: string,
    input: Partial<Pick<Alert, "condition" | "threshold" | "enabled">>,
  ): Promise<Alert> {
    const row = await prisma.alert.update({ where: { id }, data: input });
    return toDomainAlert(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.alert.delete({ where: { id } });
  }
}
