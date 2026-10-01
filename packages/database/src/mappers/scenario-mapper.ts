import type { Prisma, Scenario as PrismaScenario } from "../../generated/client/index.js";
import type {
  CreateScenarioInput,
  Scenario,
  ScenarioChange,
  ScenarioStatus,
} from "@trading/domain";

function toDomainStatus(status: PrismaScenario["status"]): ScenarioStatus {
  return status;
}

/**
 * Reads the persisted `changes` JSON column into `ScenarioChange[]`.
 *
 * The column is only ever written through this repository (typed
 * `ScenarioChange[]`, validated by the domain), so well-formed data is
 * the normal case. The read path is still defensive because a Json
 * column cannot guarantee its shape: anything that is not an array
 * yields no changes, and individual entries that do not have a string
 * `assetId` and a finite numeric `percentChange` are skipped. A read
 * must never fail (or return a half-typed object) because of one bad
 * stored entry.
 */
export function toDomainChanges(value: Prisma.JsonValue): ScenarioChange[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const changes: ScenarioChange[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }

    const { assetId, percentChange } = entry;

    if (typeof assetId === "string" && typeof percentChange === "number") {
      if (Number.isFinite(percentChange)) {
        changes.push({ assetId, percentChange });
      }
    }
  }

  return changes;
}

export function toDomainScenario(row: PrismaScenario): Scenario {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    name: row.name,
    description: row.description,
    baseSnapshotId: row.baseSnapshotId,
    status: toDomainStatus(row.status),
    changes: toDomainChanges(row.changes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPrismaChanges(changes: readonly ScenarioChange[]): Prisma.InputJsonValue {
  return changes.map((change) => ({
    assetId: change.assetId,
    percentChange: change.percentChange,
  }));
}

export function toPrismaCreateInput(input: CreateScenarioInput) {
  return {
    portfolioId: input.portfolioId,
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.baseSnapshotId !== undefined ? { baseSnapshotId: input.baseSnapshotId } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    // Omitted => the schema's @default("[]") applies.
    ...(input.changes !== undefined ? { changes: toPrismaChanges(input.changes) } : {}),
  };
}
