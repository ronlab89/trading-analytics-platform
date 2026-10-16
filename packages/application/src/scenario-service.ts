import {
  calculateScenarioImpact,
  compareScenarioImpacts,
  ScenarioStatus,
  validateNewScenario,
  validateScenarioChanges,
} from "@trading/domain";
import type {
  BaselineAssetRow,
  CreateScenarioInput,
  PortfolioMetrics,
  PositionRepository,
  Scenario,
  ScenarioAssetRow,
  ScenarioChange,
  ScenarioComparisonEntry,
  ScenarioImpactResult,
  ScenarioRepository,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import type { AssetService } from "./asset-service.js";
import { ConflictError, NotFoundError, ValidationFailedError } from "./errors.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import { assertPortfolioWritable } from "./portfolio-guard.js";
import type { PortfolioService } from "./portfolio-service.js";

export interface ScenarioServiceDependencies {
  scenarioRepository: Pick<
    ScenarioRepository,
    "listByPortfolioId" | "getById" | "create" | "update" | "delete"
  >;
  positionRepository: Pick<PositionRepository, "listByPortfolioId">;
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  assetService: Pick<AssetService, "getAssetsByIds">;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

export interface ListScenariosFilter {
  status?: ScenarioStatus;
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

export interface CreateScenarioRequest {
  name: string;
  description?: string;
  changes?: readonly ScenarioChange[];
}

export interface UpdateScenarioRequest {
  name?: string;
  description?: string;
  status?: typeof ScenarioStatus.DRAFT | typeof ScenarioStatus.SAVED;
  changes?: readonly ScenarioChange[];
}

export interface ArchiveScenarioResult {
  scenario: Scenario;
  alreadyArchived: boolean;
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
 * Scenario Lab use cases.
 * Source: FR-036..FR-043, 07-api-spec.md §25.
 *
 * Reads need `scenario:read`, writes need `scenario:write`. Ownership is
 * enforced through the portfolio, and a scenario from another portfolio is
 * indistinguishable from a missing one (anti-enumeration).
 */
export function createScenarioService(dependencies: ScenarioServiceDependencies) {
  const {
    scenarioRepository,
    positionRepository,
    portfolioService,
    assetService,
    permissions = ROLE_PERMISSIONS,
  } = dependencies;

  /** Loads a scenario and checks it belongs to the given portfolio. */
  async function findScenarioInPortfolio(
    portfolioId: string,
    scenarioId: string,
  ): Promise<Scenario> {
    const scenario = await scenarioRepository.getById(scenarioId);

    if (scenario?.portfolioId !== portfolioId) {
      throw new NotFoundError("The requested resource could not be found.");
    }

    return scenario;
  }

  /**
   * Checks that every asset a scenario changes exists. Reports ALL the
   * unknown ones at once (one detail each) so the client can fix them in a
   * single round trip.
   *
   * Only existence is checked, not whether the portfolio holds the asset:
   * a scenario may legitimately mention an asset before buying it, and
   * `calculate` reports changes it could not match (`unmatchedAssetIds`).
   *
   * A validation failure rather than a not-found (unlike createAlert)
   * because the missing thing is a field inside the body, not the resource
   * addressed by the URL.
   */
  async function assertChangedAssetsExist(
    actor: Actor,
    changes: readonly ScenarioChange[],
  ): Promise<void> {
    if (changes.length === 0) {
      return;
    }

    const assets = await assetService.getAssetsByIds(
      actor,
      changes.map((change) => change.assetId),
    );
    const unknown = changes.filter((change) => !assets.has(change.assetId));

    if (unknown.length > 0) {
      throw new ValidationFailedError(
        "The scenario references assets that do not exist.",
        unknown.map((change) => ({
          field: "changes",
          code: "UNKNOWN_ASSET",
          message: `Unknown asset: ${change.assetId}`,
        })),
      );
    }
  }

  /**
   * Returns a portfolio's scenarios, newest first, optionally filtered by
   * status. Filtering is done in memory: a portfolio holds few scenarios.
   */
  async function listScenarios(
    actor: Actor,
    portfolioId: string,
    filter: ListScenariosFilter,
  ): Promise<Scenario[]> {
    assertPermission(actor, "scenario:read", permissions);
    await portfolioService.getPortfolioById(actor, portfolioId);

    const scenarios = await scenarioRepository.listByPortfolioId(portfolioId);

    return filter.status === undefined
      ? scenarios
      : scenarios.filter((scenario) => scenario.status === filter.status);
  }

  /** Returns a single scenario, including its variable changes. */
  async function getScenarioById(
    actor: Actor,
    portfolioId: string,
    scenarioId: string,
  ): Promise<Scenario> {
    assertPermission(actor, "scenario:read", permissions);
    await portfolioService.getPortfolioById(actor, portfolioId);

    return findScenarioInPortfolio(portfolioId, scenarioId);
  }

  /**
   * Calculates a scenario's impact on its portfolio, on demand
   * (FR-038, 05-data-model.md §16: results are derived, never persisted).
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
  async function calculateScenario(
    actor: Actor,
    portfolioId: string,
    scenarioId: string,
  ): Promise<ScenarioCalculationResult> {
    assertPermission(actor, "scenario:read", permissions);
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);
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
   * Creates a scenario in a portfolio the actor owns, as a DRAFT (FR-036).
   *
   * Only the `scenarios` table is written, so the baseline portfolio is
   * untouched (01-product-spec.md §15.1). Domain invariants run before
   * the asset lookup, so a malformed list fails fast without a query.
   */
  async function createScenario(
    actor: Actor,
    portfolioId: string,
    input: CreateScenarioRequest,
  ): Promise<Scenario> {
    assertPermission(actor, "scenario:write", permissions);
    assertPortfolioWritable(await portfolioService.getPortfolioById(actor, portfolioId));

    const createInput: CreateScenarioInput = {
      portfolioId,
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.changes !== undefined ? { changes: input.changes } : {}),
    };

    validateNewScenario(createInput);
    await assertChangedAssetsExist(actor, input.changes ?? []);

    return scenarioRepository.create(createInput);
  }

  /**
   * Updates a scenario's name, description, status and/or variables
   * (FR-037 modify variables, FR-039 reset with `changes: []`, FR-040 save
   * with `status: SAVED`).
   *
   * - `changes` replaces the whole list.
   * - An ARCHIVED scenario is read-only: editing it is a conflict. There is
   *   no way back from ARCHIVED, which keeps the lifecycle simple (no FR
   *   asks for un-archiving).
   * - All validation happens before the single write, and the write is
   *   one repository call, so a failed request changes nothing.
   */
  async function updateScenario(
    actor: Actor,
    portfolioId: string,
    scenarioId: string,
    input: UpdateScenarioRequest,
  ): Promise<Scenario> {
    assertPermission(actor, "scenario:write", permissions);
    assertPortfolioWritable(await portfolioService.getPortfolioById(actor, portfolioId));
    const existing = await findScenarioInPortfolio(portfolioId, scenarioId);

    if (existing.status === ScenarioStatus.ARCHIVED) {
      throw new ConflictError("An archived scenario cannot be modified.");
    }

    if (input.changes !== undefined) {
      validateScenarioChanges(input.changes);
      await assertChangedAssetsExist(actor, input.changes);
    }

    const updateInput: Partial<Pick<Scenario, "name" | "description" | "status" | "changes">> = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.changes !== undefined ? { changes: input.changes } : {}),
    };

    return scenarioRepository.update(scenarioId, updateInput);
  }

  /**
   * Archives a scenario (status transition, not deletion).
   *
   * Idempotent, same as archivePortfolio: archiving an archived scenario
   * is not an error; `alreadyArchived` tells the client whether this call
   * changed anything.
   */
  async function archiveScenario(
    actor: Actor,
    portfolioId: string,
    scenarioId: string,
  ): Promise<ArchiveScenarioResult> {
    assertPermission(actor, "scenario:write", permissions);
    assertPortfolioWritable(await portfolioService.getPortfolioById(actor, portfolioId));
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
   * Permanently deletes a scenario, whatever its status (FR-043).
   *
   * Safe to hard-delete: a scenario is hypothetical and nothing else
   * references it (results are derived, never stored).
   */
  async function deleteScenario(
    actor: Actor,
    portfolioId: string,
    scenarioId: string,
  ): Promise<void> {
    assertPermission(actor, "scenario:write", permissions);
    assertPortfolioWritable(await portfolioService.getPortfolioById(actor, portfolioId));
    await findScenarioInPortfolio(portfolioId, scenarioId);

    await scenarioRepository.delete(scenarioId);
  }

  /**
   * Compares the portfolio's current state against 1 or more of its
   * scenarios, side by side (FR-042, 01-product-spec.md §15.2).
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
   * not exist or belongs elsewhere makes the whole request a not-found, so
   * a comparison never silently drops a column.
   */
  async function compareScenarios(
    actor: Actor,
    portfolioId: string,
    scenarioIds: readonly string[],
  ): Promise<ScenarioComparisonResult> {
    assertPermission(actor, "scenario:read", permissions);
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);
    const scenarios = await Promise.all(
      scenarioIds.map((scenarioId) => findScenarioInPortfolio(portfolioId, scenarioId)),
    );

    const positions = await positionRepository.listByPortfolioId(portfolioId);
    const comparison = compareScenarioImpacts(
      portfolio,
      positions,
      scenarios.map((scenario) => ({ id: scenario.id, changes: scenario.changes })),
    );

    const assets = await assetService.getAssetsByIds(
      actor,
      positions.map((position) => position.assetId),
    );
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
          // Unreachable: the entries come from the scenarios loaded above. A
          // plain Error is not classified by the HTTP handler, so it would
          // surface as a generic 500.
          throw new Error(`Comparison returned an unknown scenario: ${entry.scenarioId}.`);
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

  return {
    listScenarios,
    getScenarioById,
    calculateScenario,
    createScenario,
    updateScenario,
    archiveScenario,
    deleteScenario,
    compareScenarios,
  };
}

export type ScenarioService = ReturnType<typeof createScenarioService>;
