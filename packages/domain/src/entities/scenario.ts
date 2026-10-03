import type { ScenarioStatus } from "./enums";

/**
 * Scenario entity.
 * Source: docs/05-data-model.md §14-16
 *
 * Represents an isolated hypothetical modification to a portfolio.
 * References Portfolio only through `portfolioId`, keeping the two
 * entities decoupled (NFR-011, Domain Isolation).
 *
 * `changes` are the scenario's variables (§15, "Scenario Variable"): a
 * scenario IS its set of hypothetical modifications relative to the
 * baseline, so they are part of the entity — without being able to
 * read them back there is no way to calculate, show or duplicate a
 * saved scenario (FR-037, FR-038, FR-041). Earlier versions of this
 * file left them out because §15 says the persistence representation
 * is implementation-dependent; that only concerns how they are stored,
 * not whether the domain can see them. The calculated impact (§16,
 * "Scenario Result") is still NOT part of the entity: it is derived
 * and recomputed on demand (calculations/scenario-impact.ts).
 *
 * `baseSnapshotId` references the baseline state the scenario was
 * created from — §14 keeps this deliberately abstract. It is nullable
 * because a scenario may exist conceptually before a concrete baseline
 * snapshot has been captured. Nothing creates snapshots today: the
 * baseline is always the portfolio's live positions, and isolation is
 * guaranteed by the impact calculation being pure.
 */
export interface Scenario {
  readonly id: string;
  readonly portfolioId: string;
  readonly name: string;
  readonly description: string | null;
  readonly baseSnapshotId: string | null;
  readonly status: ScenarioStatus;
  readonly changes: readonly ScenarioChange[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A single hypothetical modification within a scenario.
 * Source: docs/05-data-model.md §15 (Scenario Variable).
 *
 * The only variable supported today is a percentage change applied to
 * an asset's current price (what `calculateScenarioImpact` computes).
 * This is the single declaration of the shape: the impact calculation,
 * the repository contract and the persisted JSON column all use it.
 */
export interface ScenarioChange {
  readonly assetId: string;
  /** Percentage change to apply to the current price, e.g. -12 for -12%, 5 for +5%. */
  readonly percentChange: number;
}

/** A price cannot fall below zero, so the lowest valid change is -100%. */
export const MIN_SCENARIO_PERCENT_CHANGE = -100;

export type CreateScenarioInput = Pick<Scenario, "portfolioId" | "name"> &
  Partial<Pick<Scenario, "description" | "baseSnapshotId" | "status" | "changes">>;

export class InvalidScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidScenarioError";
  }
}

/**
 * Domain invariants for a scenario's variable changes.
 * Source: FR-037 (Modify Scenario Variables), 05-data-model.md §15, §38
 * ("valid asset", "valid numeric range").
 *
 * - every change references an asset;
 * - the percentage is a finite number, not below -100%;
 * - an asset appears at most once (two entries for the same asset would
 *   be ambiguous: which one wins?).
 *
 * Whether the asset exists or is held by the portfolio is NOT checked
 * here: that needs data this module does not have (application layer).
 */
export function validateScenarioChanges(changes: readonly ScenarioChange[]): void {
  const seenAssetIds = new Set<string>();

  for (const change of changes) {
    if (!change.assetId || change.assetId.trim().length === 0) {
      throw new InvalidScenarioError("Every scenario change must reference an asset.");
    }

    if (!Number.isFinite(change.percentChange)) {
      throw new InvalidScenarioError("A scenario change percentage must be a finite number.");
    }

    if (change.percentChange < MIN_SCENARIO_PERCENT_CHANGE) {
      throw new InvalidScenarioError(
        `A scenario change cannot be below ${String(MIN_SCENARIO_PERCENT_CHANGE)}%.`,
      );
    }

    if (seenAssetIds.has(change.assetId)) {
      throw new InvalidScenarioError(
        `Asset ${change.assetId} appears more than once in the scenario changes.`,
      );
    }

    seenAssetIds.add(change.assetId);
  }
}

/**
 * Domain invariants for Scenario creation.
 */
export function validateNewScenario(input: CreateScenarioInput): void {
  if (!input.portfolioId || input.portfolioId.trim().length === 0) {
    throw new InvalidScenarioError("A scenario must belong to a portfolio.");
  }

  if (!input.name || input.name.trim().length === 0) {
    throw new InvalidScenarioError("Scenario name is required.");
  }

  if (input.changes !== undefined) {
    validateScenarioChanges(input.changes);
  }
}
