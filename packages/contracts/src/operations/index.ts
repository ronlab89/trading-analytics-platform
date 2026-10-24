import type { ApiOperation } from "../api-operation.js";
import { alertOperations, notificationOperations } from "./alerts.js";
import { analyticsOperations, userOperations } from "./analytics.js";
import { authOperations } from "./auth.js";
import { decisionOperations } from "./decisions.js";
import { marketOperations } from "./market.js";
import { portfolioOperations } from "./portfolios.js";
import { scenarioOperations } from "./scenarios.js";
import { healthOperations, simulationOperations } from "./service.js";
import { transactionOperations } from "./transactions.js";

export { idempotencyKeyHeaderSchema } from "./shared.js";
export { alertOperations, notificationOperations } from "./alerts.js";
export { analyticsOperations, userOperations } from "./analytics.js";
export { authOperations } from "./auth.js";
export { decisionOperations } from "./decisions.js";
export { marketOperations } from "./market.js";
export { portfolioOperations } from "./portfolios.js";
export { scenarioOperations } from "./scenarios.js";
export { healthOperations, simulationOperations } from "./service.js";
export { transactionOperations } from "./transactions.js";

/**
 * Every HTTP endpoint of the API, described as data. A test compares this
 * list with the routes the API mounts (B6.4), so an endpoint added without
 * its operation, or the other way round, fails the build.
 */
export const API_OPERATIONS: readonly ApiOperation[] = [
  ...portfolioOperations,
  ...transactionOperations,
  ...decisionOperations,
  ...scenarioOperations,
  ...authOperations,
  ...marketOperations,
  ...analyticsOperations,
  ...userOperations,
  ...alertOperations,
  ...notificationOperations,
  ...simulationOperations,
  ...healthOperations,
];
