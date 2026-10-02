import { z } from "zod";
import { ScenarioStatus } from "@trading/domain";
import type { ScenarioStatus as ScenarioStatusValue } from "@trading/domain";

const scenarioStatusValues = Object.values(ScenarioStatus) as [
  ScenarioStatusValue,
  ...ScenarioStatusValue[],
];

/**
 * Query-parameter validation for
 * GET /api/v1/portfolios/:portfolioId/scenarios.
 * Source: 07-api-spec.md §25 (List Scenarios).
 *
 * The spec defines no filters; `status` is added so a client can hide
 * archived scenarios without fetching and filtering them itself
 * (documented as a divergence in 07-api-spec.md §25).
 */
export const listScenariosQuerySchema = z.object({
  status: z.enum(scenarioStatusValues).optional(),
});

export type ListScenariosQuery = z.infer<typeof listScenariosQuerySchema>;
