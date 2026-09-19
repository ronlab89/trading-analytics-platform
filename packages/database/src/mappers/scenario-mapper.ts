import type { Scenario as PrismaScenario } from "../../generated/client/index.js";
import type { CreateScenarioInput, Scenario, ScenarioStatus } from "@trading/domain";

function toDomainStatus(status: PrismaScenario["status"]): ScenarioStatus {
  return status;
}

/**
 * Deliberately does NOT read `row.changes`: the domain `Scenario` entity
 * does not include a `changes` field (see entities/scenario.ts's module
 * comment — the SDD keeps the variable-changes shape out of the entity
 * itself). This mirrors that decision at the persistence boundary rather
 * than reintroducing a field the domain intentionally left out.
 */
export function toDomainScenario(row: PrismaScenario): Scenario {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    name: row.name,
    description: row.description,
    baseSnapshotId: row.baseSnapshotId,
    status: toDomainStatus(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPrismaCreateInput(input: CreateScenarioInput) {
  return {
    portfolioId: input.portfolioId,
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.baseSnapshotId !== undefined ? { baseSnapshotId: input.baseSnapshotId } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  };
}
