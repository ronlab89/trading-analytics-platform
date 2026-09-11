import type { ScenarioStatus } from "./enums";

/**
 * Scenario entity.
 * Source: docs/05-data-model.md §14-16
 *
 * Represents an isolated hypothetical modification to a portfolio.
 * References Portfolio only through `portfolioId`, keeping the two
 * entities decoupled (NFR-011, Domain Isolation).
 *
 * `baseSnapshotId` references the baseline state the scenario was
 * created from — §14 keeps this deliberately abstract ("the exact
 * persistence representation should remain implementation-dependent").
 * It is nullable because a scenario may exist conceptually before a
 * concrete baseline snapshot has been captured.
 *
 * The actual variable changes (§15, "Scenario Variable") and their
 * calculated impact (§16, "Scenario Result") are NOT part of this
 * entity's shape — this file only defines the Scenario record itself.
 * The impact calculation lives in calculations/scenario-impact.ts,
 * which intentionally does not depend on this entity (see that file's
 * module comment for the reasoning).
 */
export interface Scenario {
  readonly id: string;
  readonly portfolioId: string;
  readonly name: string;
  readonly description: string | null;
  readonly baseSnapshotId: string | null;
  readonly status: ScenarioStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type CreateScenarioInput = Pick<Scenario, "portfolioId" | "name"> &
  Partial<Pick<Scenario, "description" | "baseSnapshotId" | "status">>;

export class InvalidScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidScenarioError";
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
}
