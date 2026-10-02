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

/**
 * One scenario variable: a percentage change to an asset's price.
 * Shape/type only: domain invariants (not below -100%, one entry per
 * asset) are enforced by `validateScenarioChanges` in @trading/domain,
 * and the asset's existence by the service (09-security-spec.md §19).
 */
const scenarioChangeSchema = z.object({
  assetId: z.string().min(1, "Asset is required."),
  percentChange: z.number(),
});

/**
 * POST /api/v1/portfolios/:portfolioId/scenarios
 * Source: 07-api-spec.md §25 (Create Scenario), FR-036.
 *
 * `changes` is optional (default: none, i.e. a scenario identical to
 * the baseline) so the Scenario Lab can create an empty scenario first
 * and then edit its variables (FR-037).
 */
export const createScenarioRequestSchema = z.object({
  name: z.string().trim().min(1, "Scenario name is required."),
  description: z.string().optional(),
  changes: z.array(scenarioChangeSchema).optional(),
});

export type CreateScenarioRequestBody = z.infer<typeof createScenarioRequestSchema>;

/**
 * PATCH /api/v1/portfolios/:portfolioId/scenarios/:scenarioId
 * Source: 07-api-spec.md §25 (Update Scenario), FR-037, FR-039, FR-040.
 *
 * - `changes` REPLACES the whole list (an empty array resets the
 *   scenario, FR-039).
 * - `status` only accepts DRAFT or SAVED (save, FR-040). ARCHIVED is
 *   reached through the dedicated archive endpoint.
 * - At least one field must be present.
 */
export const updateScenarioRequestSchema = z
  .object({
    name: z.string().trim().min(1, "Scenario name is required.").optional(),
    description: z.string().optional(),
    status: z.enum(["DRAFT", "SAVED"]).optional(),
    changes: z.array(scenarioChangeSchema).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.changes !== undefined,
    { message: "At least one field (name, description, status or changes) must be provided." },
  );

export type UpdateScenarioRequestBody = z.infer<typeof updateScenarioRequestSchema>;
