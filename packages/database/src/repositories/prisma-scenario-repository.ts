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
  type OnScenarioChangesSkipped,
} from "../mappers/scenario-mapper.js";

export interface PrismaScenarioRepositoryOptions {
  /** Called for each stored `changes` entry the defensive read drops. */
  onChangesSkipped?: OnScenarioChangesSkipped;
}

export class PrismaScenarioRepository implements ScenarioRepository {
  private readonly onChangesSkipped: OnScenarioChangesSkipped | undefined;

  constructor(options: PrismaScenarioRepositoryOptions = {}) {
    this.onChangesSkipped = options.onChangesSkipped;
  }

  async listByPortfolioId(portfolioId: string): Promise<Scenario[]> {
    const rows = await prisma.scenario.findMany({
      where: { portfolioId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    return rows.map((row) => toDomainScenario(row, this.onChangesSkipped));
  }

  async getById(id: string): Promise<Scenario | null> {
    const row = await prisma.scenario.findUnique({ where: { id } });
    return row ? toDomainScenario(row, this.onChangesSkipped) : null;
  }

  async create(input: CreateScenarioInput): Promise<Scenario> {
    const row = await prisma.scenario.create({ data: toPrismaCreateInput(input) });
    return toDomainScenario(row, this.onChangesSkipped);
  }

  async update(
    id: string,
    input: Partial<Pick<Scenario, "name" | "description" | "status" | "changes">>,
  ): Promise<Scenario> {
    const { changes, ...rest } = input;
    const row = await prisma.scenario.update({
      where: { id },
      data: {
        ...rest,
        ...(changes !== undefined ? { changes: toPrismaChanges(changes) } : {}),
      },
    });
    return toDomainScenario(row, this.onChangesSkipped);
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
    return toDomainScenario(row, this.onChangesSkipped);
  }

  async delete(id: string): Promise<void> {
    await prisma.scenario.delete({ where: { id } });
  }
}
