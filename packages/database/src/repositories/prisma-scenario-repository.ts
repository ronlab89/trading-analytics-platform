import type {
  CreateScenarioInput,
  Scenario,
  ScenarioChange,
  ScenarioRepository,
} from "@trading/domain";
import { prisma } from "../client.js";
import {
  toDomainScenario,
  toPrismaChanges,
  toPrismaCreateInput,
} from "../mappers/scenario-mapper.js";

export class PrismaScenarioRepository implements ScenarioRepository {
  async listByPortfolioId(portfolioId: string): Promise<Scenario[]> {
    const rows = await prisma.scenario.findMany({
      where: { portfolioId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    return rows.map(toDomainScenario);
  }

  async getById(id: string): Promise<Scenario | null> {
    const row = await prisma.scenario.findUnique({ where: { id } });
    return row ? toDomainScenario(row) : null;
  }

  async create(input: CreateScenarioInput): Promise<Scenario> {
    const row = await prisma.scenario.create({ data: toPrismaCreateInput(input) });
    return toDomainScenario(row);
  }

  async update(
    id: string,
    input: Partial<Pick<Scenario, "name" | "description" | "status">>,
  ): Promise<Scenario> {
    const row = await prisma.scenario.update({ where: { id }, data: input });
    return toDomainScenario(row);
  }

  /**
   * Replaces the scenario's `changes` and returns the updated scenario,
   * whose `changes` reflect what was just stored.
   */
  async updateChanges(id: string, changes: readonly ScenarioChange[]): Promise<Scenario> {
    const row = await prisma.scenario.update({
      where: { id },
      data: { changes: toPrismaChanges(changes) },
    });
    return toDomainScenario(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.scenario.delete({ where: { id } });
  }
}
