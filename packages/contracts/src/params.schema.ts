import { z } from "zod";

/**
 * Route-parameter IDs. Deliberately lenient (shape, not cuid): a
 * well-formed ID that does not exist or is not the caller's stays a 404,
 * only a malformed value is a 400. Keeps the contract independent of how
 * the database generates IDs.
 */
export const resourceIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "Must be 1-64 characters: letters, digits, '_' or '-'.");

export const assetIdParamsSchema = z.object({ assetId: resourceIdSchema });
export const alertIdParamsSchema = z.object({ alertId: resourceIdSchema });
export const notificationIdParamsSchema = z.object({ notificationId: resourceIdSchema });
export const decisionIdParamsSchema = z.object({ decisionId: resourceIdSchema });
export const portfolioIdParamsSchema = z.object({ portfolioId: resourceIdSchema });
export const portfolioPositionParamsSchema = portfolioIdParamsSchema.extend({
  positionId: resourceIdSchema,
});
export const portfolioDecisionParamsSchema = portfolioIdParamsSchema.extend({
  decisionId: resourceIdSchema,
});
export const portfolioTransactionParamsSchema = portfolioIdParamsSchema.extend({
  transactionId: resourceIdSchema,
});
export const portfolioScenarioParamsSchema = portfolioIdParamsSchema.extend({
  scenarioId: resourceIdSchema,
});
