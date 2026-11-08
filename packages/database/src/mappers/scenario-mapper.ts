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
 * What the defensive read of `changes` dropped. Never carries the stored
 * value, which in a corrupted column can be anything.
 */
export interface SkippedChanges {
  reason: "not_an_array" | "not_an_object" | "invalid_asset_or_percent";
  /** Position of the dropped entry; absent when the whole column was dropped. */
  index?: number;
}

export type OnChangesSkipped = (skipped: SkippedChanges) => void;

/** A `SkippedChanges` tied to the scenario row it came from. */
export type OnScenarioChangesSkipped = (skipped: SkippedChanges & { scenarioId: string }) => void;

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
 * stored entry. Each drop is reported to `onSkipped`, so corruption can
 * surface instead of passing as an empty scenario.
 */
export function toDomainChanges(
  value: Prisma.JsonValue,
  onSkipped?: OnChangesSkipped,
): ScenarioChange[] {
  if (!Array.isArray(value)) {
    onSkipped?.({ reason: "not_an_array" });
    return [];
  }

  const changes: ScenarioChange[] = [];

  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      onSkipped?.({ reason: "not_an_object", index });
      continue;
    }

    const { assetId, percentChange } = entry;

    if (
      typeof assetId === "string" &&
      typeof percentChange === "number" &&
      Number.isFinite(percentChange)
    ) {
      changes.push({ assetId, percentChange });
    } else {
      onSkipped?.({ reason: "invalid_asset_or_percent", index });
    }
  }

  return changes;
}

export function toDomainScenario(
  row: PrismaScenario,
  onSkipped?: OnScenarioChangesSkipped,
): Scenario {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    name: row.name,
    description: row.description,
    baseSnapshotId: row.baseSnapshotId,
    status: toDomainStatus(row.status),
    changes: toDomainChanges(
      row.changes,
      onSkipped &&
        ((skipped) => {
          onSkipped({ scenarioId: row.id, ...skipped });
        }),
    ),
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
