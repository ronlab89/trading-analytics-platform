import { validateNewAlert } from "@trading/domain";
import { PrismaAlertRepository } from "../../repositories/prisma-alert-repository.js";
import { SEED_ALERTS } from "../data/alerts.js";
import { resolvePortfolioId, resolveAssetId } from "../resolve.js";
import type { SeedContext } from "../context.js";

const alertRepository = new PrismaAlertRepository();

/**
 * Seeds alerts (active, already-crossed, and manually disabled).
 * Source: 05-data-model.md §22, 12-demo-mode-spec.md §13.
 */
export async function seedAlerts(context: SeedContext): Promise<SeedContext> {
  console.log("[seed] seeding alerts...");

  if (context.userId === undefined) {
    throw new Error("[seed] cannot seed alerts before a user has been seeded.");
  }
  const userId = context.userId;

  for (const blueprint of SEED_ALERTS) {
    const input = {
      userId,
      type: blueprint.type,
      condition: blueprint.condition,
      threshold: blueprint.threshold,
      enabled: blueprint.enabled,
      ...(blueprint.assetSymbol !== undefined
        ? { assetId: resolveAssetId(context, blueprint.assetSymbol) }
        : {}),
      ...(blueprint.portfolioName !== undefined
        ? { portfolioId: resolvePortfolioId(context, blueprint.portfolioName) }
        : {}),
    };

    validateNewAlert(input);
    await alertRepository.create(input);
  }

  return context;
}
