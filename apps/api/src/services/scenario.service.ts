import { PrismaPositionRepository, PrismaScenarioRepository } from "@trading/database";
import {
  calculateScenarioImpact,
  type PortfolioMetrics,
  type Scenario,
  type ScenarioImpactResult,
  type ScenarioStatus,
} from "@trading/domain";
import { AppError } from "../errors/app-error.js";
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
