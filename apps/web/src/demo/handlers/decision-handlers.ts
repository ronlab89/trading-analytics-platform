import { presentDecision, presentDecisionReplay } from "@trading/contracts";
import type { ListDecisionsQuery } from "@trading/contracts";
import type { HandlerContext, HandlerRegistry } from "./handler";

/** Mirrors `decisions.controller.ts` of the API (read-only), on the same `DecisionService`. */
export function createDecisionHandlers({ composition }: HandlerContext): HandlerRegistry {
  const { decisionService, actor } = composition;

  return {
    listDecisions: async ({ params, query }) => {
      const { portfolioId } = params as { portfolioId: string };
      const { assetId, direction, dateFrom, dateTo } = query as ListDecisionsQuery;
      const decisions = await decisionService.listDecisions(actor, portfolioId, {
        ...(assetId !== undefined ? { assetId } : {}),
        ...(direction !== undefined ? { direction } : {}),
        ...(dateFrom !== undefined ? { dateFrom } : {}),
        ...(dateTo !== undefined ? { dateTo } : {}),
      });
      return { data: decisions.map(presentDecision) };
    },
    getDecision: async ({ params }) => {
      const { portfolioId, decisionId } = params as { portfolioId: string; decisionId: string };
      const decision = await decisionService.getDecisionById(actor, portfolioId, decisionId);
      return { data: presentDecision(decision) };
    },
    getDecisionReplay: async ({ params }) => {
      const { decisionId } = params as { decisionId: string };
      return {
        data: presentDecisionReplay(await decisionService.getDecisionReplay(actor, decisionId)),
      };
    },
  };
}
