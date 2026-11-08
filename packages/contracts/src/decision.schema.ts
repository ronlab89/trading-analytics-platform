import { z } from "zod";
import { DecisionDirection } from "@trading/domain";
import type { DecisionDirection as DecisionDirectionValue } from "@trading/domain";

const decisionDirectionValues = Object.values(DecisionDirection) as [
  DecisionDirectionValue,
  ...DecisionDirectionValue[],
];

/**
 * Query-parameter validation for
 * GET /api/v1/portfolios/:portfolioId/decisions.
 * Source: 07-api-spec.md §23 (List Decisions filters), FR-032.
 *
 * Only the filters `DecisionRepository.listByPortfolioId` supports are
 * exposed: `outcome`, `page` and `pageSize` from the spec are not
 * implemented (a portfolio has few decisions, and `outcome` is a
 * free-form string). Documented as a divergence in 07-api-spec.md §23.
 */
export const listDecisionsQuerySchema = z.object({
  assetId: z.string().min(1).optional(),
  direction: z.enum(decisionDirectionValues).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type ListDecisionsQuery = z.infer<typeof listDecisionsQuerySchema>;
