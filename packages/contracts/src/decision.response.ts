import { z } from "zod";
import { DecisionDirection } from "@trading/domain";
import type { Decision } from "@trading/domain";
import {
  isoTimestampSchema,
  moneySchema,
  presentMoney,
  presentTimestamp,
} from "./response-common.schema.js";

const decisionDirectionValues = Object.values(DecisionDirection) as [
  DecisionDirection,
  ...DecisionDirection[],
];

/**
 * Response shape for the decision endpoints.
 * Source: 07-api-spec.md §23, 05-data-model.md §11, FR-032.
 */
export const decisionResponseSchema = z.object({
  id: z.string(),
  portfolioId: z.string(),
  assetId: z.string(),
  title: z.string(),
  thesis: z.string(),
  direction: z.enum(decisionDirectionValues),
  entryPrice: moneySchema.nullable(),
  targetPrice: moneySchema.nullable(),
  stopPrice: moneySchema.nullable(),
  riskLevel: z.string().nullable(),
  createdAt: isoTimestampSchema,
  closedAt: isoTimestampSchema.nullable(),
  outcome: z.string().nullable(),
  notes: z.string().nullable(),
});
export type DecisionResponse = z.infer<typeof decisionResponseSchema>;

export function presentDecision(decision: Decision): DecisionResponse {
  return {
    id: decision.id,
    portfolioId: decision.portfolioId,
    assetId: decision.assetId,
    title: decision.title,
    thesis: decision.thesis,
    direction: decision.direction,
    entryPrice: decision.entryPrice ? presentMoney(decision.entryPrice) : null,
    targetPrice: decision.targetPrice ? presentMoney(decision.targetPrice) : null,
    stopPrice: decision.stopPrice ? presentMoney(decision.stopPrice) : null,
    riskLevel: decision.riskLevel,
    createdAt: presentTimestamp(decision.createdAt),
    closedAt: decision.closedAt ? presentTimestamp(decision.closedAt) : null,
    outcome: decision.outcome,
    notes: decision.notes,
  };
}
