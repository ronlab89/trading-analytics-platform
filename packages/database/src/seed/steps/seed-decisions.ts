import { validateNewDecision, validateNewDecisionEvent } from "@trading/domain";
import { PrismaDecisionRepository } from "../../repositories/prisma-decision-repository.js";
import { PrismaDecisionEventRepository } from "../../repositories/prisma-decision-event-repository.js";
import { SEED_DECISIONS } from "../data/decisions.js";
import { resolvePortfolioId, resolveAssetId } from "../resolve.js";
import type { SeedContext } from "../context.js";

const decisionRepository = new PrismaDecisionRepository();
const decisionEventRepository = new PrismaDecisionEventRepository();

/**
 * Seeds decisions, their chronological event history, and closes each
 * one with its recorded outcome.
 * Source: 01-product-spec.md §14 (Decision Replay), 05-data-model.md §11-13.
 */
export async function seedDecisions(context: SeedContext): Promise<SeedContext> {
  console.log("[seed] seeding decisions and decision events...");

  for (const blueprint of SEED_DECISIONS) {
    const portfolioId = resolvePortfolioId(context, blueprint.portfolioName);
    const assetId = resolveAssetId(context, blueprint.assetSymbol);

    const decisionInput = {
      portfolioId,
      assetId,
      title: blueprint.title,
      thesis: blueprint.thesis,
      direction: blueprint.direction,
      entryPrice: blueprint.entryPrice,
      targetPrice: blueprint.targetPrice,
      stopPrice: blueprint.stopPrice,
      riskLevel: blueprint.riskLevel,
      ...(blueprint.notes !== undefined ? { notes: blueprint.notes } : {}),
    };

    validateNewDecision(decisionInput);
    const decision = await decisionRepository.create(decisionInput);

    for (const event of blueprint.events) {
      const eventInput = {
        decisionId: decision.id,
        type: event.type,
        ...(event.payload !== undefined ? { payload: event.payload } : {}),
      };

      validateNewDecisionEvent(eventInput);
      await decisionEventRepository.create(eventInput);
    }

    await decisionRepository.close(decision.id, blueprint.outcome, blueprint.closedAt);
  }

  return context;
}
