import { PrismaPositionRepository, PrismaScenarioRepository } from "@trading/database";
import {
  calculateScenarioImpact,
  compareScenarioImpacts,
  ScenarioStatus,
  validateNewScenario,
  validateScenarioChanges,
  type BaselineAssetRow,
  type CreateScenarioInput,
  type PortfolioMetrics,
  type Scenario,
  type ScenarioAssetRow,
  type ScenarioChange,
  type ScenarioComparisonEntry,
  type ScenarioImpactResult,
} from "@trading/domain";
import { AppError } from "../errors/app-error.js";
import { getAssetsByIds } from "./asset.service.js";
import { getPortfolioById } from "./portfolio.service.js";

const scenarioRepository = new PrismaScenarioRepository();
const positionRepository = new PrismaPositionRepository();

export interface ListScenariosFilter {
  status?: ScenarioStatus;
}

/**
 * Returns a portfolio's scenarios, newest first, optionally filtered by
 * status. Source: 07-api-spec.md §25 (List Scenarios).
 *
 * Ownership is enforced by requiring the portfolio to belong to the
 * caller first, same pattern as listTransactions / listDecisions.
 * Filtering is done in memory: a portfolio holds few scenarios.
 */
export async function listScenarios(
  userId: string,
  portfolioId: string,
  filter: ListScenariosFilter,
): Promise<Scenario[]> {
  await getPortfolioById(userId, portfolioId);

  const scenarios = await scenarioRepository.listByPortfolioId(portfolioId);

  return filter.status === undefined
    ? scenarios
    : scenarios.filter((scenario) => scenario.status === filter.status);
}

/**
 * Loads a scenario and checks it belongs to the given portfolio.
 * A scenario from another portfolio is indistinguishable from a
 * non-existent one (same 404, anti-enumeration).
 */
async function findScenarioInPortfolio(portfolioId: string, scenarioId: string): Promise<Scenario> {
  const scenario = await scenarioRepository.getById(scenarioId);

  if (scenario?.portfolioId !== portfolioId) {
    throw new AppError("NOT_FOUND", "The requested resource could not be found.", 404);
  }

  return scenario;
}

/**
 * Returns a single scenario, including its variable changes.
 * Source: FR-036..FR-043 (Scenario Lab), 07-api-spec.md §25.
 */
export async function getScenarioById(
  userId: string,
  portfolioId: string,
  scenarioId: string,
): Promise<Scenario> {
  await getPortfolioById(userId, portfolioId);

  return findScenarioInPortfolio(portfolioId, scenarioId);
}

export interface ScenarioCalculationResult {
  scenarioId: string;
  /** The portfolio as it is now, untouched by the scenario. */
  baseline: PortfolioMetrics;
  /** The portfolio with the scenario's price changes applied. */
  result: PortfolioMetrics;
  difference: ScenarioImpactResult["difference"];
  /**
   * Assets the scenario changes but the portfolio does not currently
   * hold. `calculateScenarioImpact` ignores them (they have no
   * position to apply to); reporting them avoids a silent no-op, e.g.
   * after the position was sold since the scenario was saved.
   */
  unmatchedAssetIds: string[];
}

/**
 * Calculates a scenario's impact on its portfolio, on demand.
 * Source: FR-038 (Recalculate Scenario), 07-api-spec.md §25, and
 * 05-data-model.md §16 (results are derived, never persisted).
 *
 * Stateless and side-effect free: it combines the stored `changes`
 * with the portfolio's CURRENT positions and returns the result
 * without writing anything. The baseline is therefore always the live
 * portfolio and cannot be modified by a scenario (FR-036, 01-product-
 * spec.md §15.1) because `calculateScenarioImpact` is pure.
 *
 * It is exposed as POST (per the spec) even though it only reads: it is
 * a computation request, not a resource fetch.
 *
 * Outputs are limited to what the domain can compute honestly today:
 * total value and unrealized P/L (see portfolio-metrics.ts). Allocation,
 * risk and exposure from FR-038's list are not calculated yet.
 */
export async function calculateScenario(
  userId: string,
  portfolioId: string,
  scenarioId: string,
): Promise<ScenarioCalculationResult> {
  const portfolio = await getPortfolioById(userId, portfolioId);
  const scenario = await findScenarioInPortfolio(portfolioId, scenarioId);

  const positions = await positionRepository.listByPortfolioId(portfolioId);
  const impact = calculateScenarioImpact(portfolio, positions, scenario.changes);

  const heldAssetIds = new Set(positions.map((position) => position.assetId));
  const unmatchedAssetIds = scenario.changes
    .map((change) => change.assetId)
    .filter((assetId) => !heldAssetIds.has(assetId));

  return {
    scenarioId: scenario.id,
    baseline: impact.baseline,
    result: impact.scenario,
    difference: impact.difference,
    unmatchedAssetIds,
  };
}

/**
 * Checks that every asset a scenario changes exists. Reports ALL the
 * unknown ones at once (400 with one detail each) so the client can fix
 * them in a single round trip.
 *
 * Only existence is checked, not whether the portfolio holds the asset:
 * a scenario may legitimately mention an asset before buying it, and
 * `calculate` reports changes it could not match (`unmatchedAssetIds`).
 *
 * Answered with 400 rather than 404 (unlike createAlert) because the
 * missing thing is a field inside the body, not the resource addressed
 * by the URL.
 */
async function assertChangedAssetsExist(changes: readonly ScenarioChange[]): Promise<void> {
  if (changes.length === 0) {
    return;
  }

  const assets = await getAssetsByIds(changes.map((change) => change.assetId));
  const unknown = changes.filter((change) => !assets.has(change.assetId));

  if (unknown.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "The scenario references assets that do not exist.",
      400,
      unknown.map((change) => ({
        field: "changes",
        code: "UNKNOWN_ASSET",
        message: `Unknown asset: ${change.assetId}`,
      })),
    );
  }
}

export interface CreateScenarioRequest {
  name: string;
  description?: string;
  changes?: readonly ScenarioChange[];
}

/**
 * Creates a scenario in a portfolio the caller owns, as a DRAFT.
 * Source: FR-036 (Create Scenario), 07-api-spec.md §25.
 *
 * Only the `scenarios` table is written, so the baseline portfolio is
 * untouched (01-product-spec.md §15.1). Domain invariants run before
 * the asset lookup, so a malformed list fails fast without a query.
 */
export async function createScenario(
  userId: string,
  portfolioId: string,
  input: CreateScenarioRequest,
): Promise<Scenario> {
  await getPortfolioById(userId, portfolioId);

  const createInput: CreateScenarioInput = {
    portfolioId,
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.changes !== undefined ? { changes: input.changes } : {}),
  };

  validateNewScenario(createInput);
  await assertChangedAssetsExist(input.changes ?? []);

  return scenarioRepository.create(createInput);
}

export interface UpdateScenarioRequest {
  name?: string;
  description?: string;
  status?: typeof ScenarioStatus.DRAFT | typeof ScenarioStatus.SAVED;
  changes?: readonly ScenarioChange[];
}

/**
 * Updates a scenario's name, description, status and/or variables.
 * Source: FR-037 (Modify Variables), FR-039 (Reset: `changes: []`),
 * FR-040 (Save: `status: SAVED`), 07-api-spec.md §25.
 *
 * - `changes` replaces the whole list.
 * - An ARCHIVED scenario is read-only: editing it is a 409 CONFLICT.
 *   There is no way back from ARCHIVED, which keeps the lifecycle
 *   simple (no FR asks for un-archiving).
 * - All validation happens before the single write, and the write is
 *   one repository call, so a failed request changes nothing.
 */
export async function updateScenario(
  userId: string,
  portfolioId: string,
  scenarioId: string,
  input: UpdateScenarioRequest,
): Promise<Scenario> {
  await getPortfolioById(userId, portfolioId);
  const existing = await findScenarioInPortfolio(portfolioId, scenarioId);

  if (existing.status === ScenarioStatus.ARCHIVED) {
    throw new AppError("CONFLICT", "An archived scenario cannot be modified.", 409);
  }

  if (input.changes !== undefined) {
    validateScenarioChanges(input.changes);
    await assertChangedAssetsExist(input.changes);
  }

  const updateInput: Partial<Pick<Scenario, "name" | "description" | "status" | "changes">> = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.changes !== undefined ? { changes: input.changes } : {}),
  };

  return scenarioRepository.update(scenarioId, updateInput);
}

export interface ArchiveScenarioResult {
  scenario: Scenario;
  alreadyArchived: boolean;
}

/**
 * Archives a scenario (status transition, not deletion).
 * Source: 07-api-spec.md §25 (Archive Scenario).
 *
 * Idempotent, same as archivePortfolio: archiving an archived scenario
 * is not an error; `alreadyArchived` tells the client whether this call
 * changed anything.
 */
export async function archiveScenario(
  userId: string,
  portfolioId: string,
  scenarioId: string,
): Promise<ArchiveScenarioResult> {
  await getPortfolioById(userId, portfolioId);
  const existing = await findScenarioInPortfolio(portfolioId, scenarioId);

  if (existing.status === ScenarioStatus.ARCHIVED) {
    return { scenario: existing, alreadyArchived: true };
  }

  const scenario = await scenarioRepository.update(scenarioId, {
    status: ScenarioStatus.ARCHIVED,
  });

  return { scenario, alreadyArchived: false };
}

/**
 * Permanently deletes a scenario (any status).
 * Source: FR-043 (Delete Scenario).
 *
 * Safe to hard-delete: a scenario is hypothetical and nothing else
 * references it (results are derived, never stored).
 */
export async function deleteScenario(
  userId: string,
  portfolioId: string,
  scenarioId: string,
): Promise<void> {
  await getPortfolioById(userId, portfolioId);
  await findScenarioInPortfolio(portfolioId, scenarioId);

  await scenarioRepository.delete(scenarioId);
}

/** Label fields the service adds to the domain's asset rows (the domain only knows ids). */
interface AssetLabel {
  symbol: string | null;
  name: string | null;
}

export interface ScenarioComparisonResult {
  /** The portfolio as it is now, untouched by any scenario. */
  baseline: {
    metrics: PortfolioMetrics;
    assets: (BaselineAssetRow & AssetLabel)[];
  };
  /** In the order the ids were requested. */
  scenarios: (Omit<ScenarioComparisonEntry, "assets"> & {
    name: string;
    status: ScenarioStatus;
    assets: (ScenarioAssetRow & AssetLabel)[];
    /** Changed assets the portfolio does not hold (ignored by the calculation). */
    unmatchedAssetIds: string[];
  })[];
}

/**
 * Compares the portfolio's current state against 1 or more of its
 * scenarios, side by side.
 * Source: FR-042 (Compare Scenarios), 01-product-spec.md §15.2.
 *
 * Read-only and stateless, like `calculateScenario`: the stored changes
 * are applied to the portfolio's CURRENT positions and nothing is
 * written, so the baseline cannot be modified. The comparison itself
 * (per-asset values, differences and allocation shifts) is the pure
 * domain function `compareScenarioImpacts`; this service only loads the
 * data, checks ownership and adds each asset's symbol and name with one
 * batched lookup.
 *
 * Every requested scenario must belong to the portfolio: one that does
 * not exist or belongs elsewhere makes the whole request a 404, so a
 * comparison never silently drops a column.
 */
export async function compareScenarios(
  userId: string,
  portfolioId: string,
  scenarioIds: readonly string[],
): Promise<ScenarioComparisonResult> {
  const portfolio = await getPortfolioById(userId, portfolioId);
  const scenarios = await Promise.all(
    scenarioIds.map((scenarioId) => findScenarioInPortfolio(portfolioId, scenarioId)),
  );

  const positions = await positionRepository.listByPortfolioId(portfolioId);
  const comparison = compareScenarioImpacts(
    portfolio,
    positions,
    scenarios.map((scenario) => ({ id: scenario.id, changes: scenario.changes })),
  );

  const assets = await getAssetsByIds(positions.map((position) => position.assetId));
  const label = (assetId: string): AssetLabel => ({
    symbol: assets.get(assetId)?.symbol ?? null,
    name: assets.get(assetId)?.name ?? null,
  });

  const heldAssetIds = new Set(positions.map((position) => position.assetId));
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

  return {
    baseline: {
      metrics: comparison.baseline.metrics,
      assets: comparison.baseline.assets.map((row) => ({ ...row, ...label(row.assetId) })),
    },
    scenarios: comparison.scenarios.map((entry) => {
      const scenario = scenarioById.get(entry.scenarioId);

      if (!scenario) {
        // Unreachable: the entries come from the scenarios loaded above.
        throw new AppError("INTERNAL_ERROR", "An unexpected error occurred.", 500);
      }

      return {
        ...entry,
        name: scenario.name,
        status: scenario.status,
        assets: entry.assets.map((row) => ({ ...row, ...label(row.assetId) })),
        unmatchedAssetIds: scenario.changes
          .map((change) => change.assetId)
          .filter((assetId) => !heldAssetIds.has(assetId)),
      };
    }),
  };
}
