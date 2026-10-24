import type { ApiOperation } from "../api-operation.js";
import { portfolioOperations } from "./portfolios.js";
import { transactionOperations } from "./transactions.js";

export { idempotencyKeyHeaderSchema } from "./shared.js";
export { portfolioOperations } from "./portfolios.js";
export { transactionOperations } from "./transactions.js";

/**
 * Every HTTP endpoint of the API, described as data. A test compares this
 * list with the routes the API mounts (B6.4), so an endpoint added without
 * its operation, or the other way round, fails the build.
 */
export const API_OPERATIONS: readonly ApiOperation[] = [
  ...portfolioOperations,
  ...transactionOperations,
];
