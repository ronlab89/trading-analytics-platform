import type {
  CreateScenarioInput,
  Scenario,
  ScenarioChange,
  ScenarioRepository,
} from "@trading/domain";
import type { Prisma } from "../../generated/client/index.js";
import { prisma } from "../client.js";
import { toDomainScenario, toPrismaCreateInput } from "../mappers/scenario-mapper.js";

export class PrismaScenarioRepository implements ScenarioRepository {
  async listByPortfolioId(portfolioId: string): Promise<Scenario[]> {
    const rows = await prisma.scenario.findMany({ where: { portfolioId } });
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
   * Persists `changes` into the Json column but returns the domain
   * `Scenario` shape, which does not itself carry `changes` (see
   * scenario-mapper.ts). Reading the changes back out is not part of
   * this contract — see ScenarioRepository's module comment.
   */
  async updateChanges(id: string, changes: ScenarioChange[]): Promise<Scenario> {
    const row = await prisma.scenario.update({
      where: { id },
      data: { changes: changes as unknown as Prisma.InputJsonValue },
    });
    return toDomainScenario(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.scenario.delete({ where: { id } });
  }
}
