import { z } from "zod";
import { ScenarioStatus } from "@trading/domain";
import type { Scenario } from "@trading/domain";
import {
  archiveMetaSchema,
  isoTimestampSchema,
  presentTimestamp,
} from "./response-common.schema.js";

const scenarioStatusValues = Object.values(ScenarioStatus) as [ScenarioStatus, ...ScenarioStatus[]];

/**
 * Response shape for the scenario CRUD endpoints.
 * Source: 07-api-spec.md §25, 05-data-model.md §14-15.
 */
export const scenarioChangeResponseSchema = z.object({
  assetId: z.string(),
  percentChange: z.number(),
});

export const scenarioResponseSchema = z.object({
  id: z.string(),
  portfolioId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  baseSnapshotId: z.string().nullable(),
  status: z.enum(scenarioStatusValues),
  changes: z.array(scenarioChangeResponseSchema),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type ScenarioResponse = z.infer<typeof scenarioResponseSchema>;

/** POST /portfolios/:portfolioId/scenarios/:scenarioId/archive: idempotent, flagged in `meta`. */
export const archiveScenarioResponseSchema = z.object({
  data: scenarioResponseSchema,
  meta: archiveMetaSchema,
});

export function presentScenario(scenario: Scenario): ScenarioResponse {
  return {
    id: scenario.id,
    portfolioId: scenario.portfolioId,
    name: scenario.name,
    description: scenario.description,
    baseSnapshotId: scenario.baseSnapshotId,
    status: scenario.status,
    changes: scenario.changes.map((change) => ({
      assetId: change.assetId,
      percentChange: change.percentChange,
    })),
    createdAt: presentTimestamp(scenario.createdAt),
    updatedAt: presentTimestamp(scenario.updatedAt),
  };
}
