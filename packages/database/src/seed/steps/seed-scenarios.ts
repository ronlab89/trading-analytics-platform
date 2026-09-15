import { validateNewScenario } from "@trading/domain";
import type { ScenarioChange } from "@trading/domain";
import { PrismaScenarioRepository } from "../../repositories/prisma-scenario-repository.js";
import { SEED_SCENARIOS } from "../data/scenarios.js";
import { resolvePortfolioId, resolveAssetId } from "../resolve.js";
import type { SeedContext } from "../context.js";

const scenarioRepository = new PrismaScenarioRepository();

/**
 * Seeds scenarios and their variable changes.
 * Source: 01-product-spec.md §15 (Scenario Lab), 05-data-model.md §14-16.
 */
export async function seedScenarios(context: SeedContext): Promise<SeedContext> {
  console.log("[seed] seeding scenarios...");

  for (const blueprint of SEED_SCENARIOS) {
    const portfolioId = resolvePortfolioId(context, blueprint.portfolioName);

    const scenarioInput = {
      portfolioId,
      name: blueprint.name,
      status: blueprint.status,
      ...(blueprint.description !== undefined ? { description: blueprint.description } : {}),
    };

    validateNewScenario(scenarioInput);
    const scenario = await scenarioRepository.create(scenarioInput);

    const changes: ScenarioChange[] = blueprint.changes.map((change) => ({
      assetId: resolveAssetId(context, change.assetSymbol),
      percentChange: change.percentChange,
    }));

    await scenarioRepository.updateChanges(scenario.id, changes);
  }

  return context;
}
