import { z } from "zod";
import type { ApiOperation } from "../api-operation.js";
import {
  allocationQuerySchema,
  analyticsPeriodQuerySchema,
  attributionQuerySchema,
} from "../analytics.schema.js";
import { allocationResponseSchema, attributionResponseSchema } from "../analytics.response.js";
import { assetIdParamsSchema, portfolioIdParamsSchema } from "../params.schema.js";
import { overviewResponseSchema } from "../overview.response.js";
import { performanceResponseSchema } from "../performance.response.js";
import { rangeAttributionResponseSchema } from "../range-attribution.response.js";
import { dataEnvelope } from "../response-common.schema.js";
import { riskResponseSchema } from "../risk.response.js";
import { userPreferenceResponseSchema } from "../user-preference.response.js";
import { updateUserPreferenceRequestSchema } from "../user-preference.schema.js";
import { watchlistItemResponseSchema } from "../watchlist.response.js";
import { addWatchlistItemRequestSchema } from "../watchlist.schema.js";

/** Analytics and the overview of a portfolio (07-api-spec.md §19-§22, 16-analytics-spec.md). */
export const analyticsOperations: readonly ApiOperation[] = [
  {
    operationId: "getPortfolioOverview",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/overview",
    tag: "Analytics",
    summary: "Get the overview of a portfolio",
    description: "One read model for the dashboard, so a screen needs a single request.",
    authenticated: true,
    params: portfolioIdParamsSchema,
    success: {
      status: 200,
      description: "The overview.",
      schema: dataEnvelope(overviewResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getPortfolioAllocation",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/analytics/allocation",
    tag: "Analytics",
    summary: "Get the allocation of a portfolio",
    authenticated: true,
    params: portfolioIdParamsSchema,
    query: allocationQuerySchema,
    success: {
      status: 200,
      description: "The allocation.",
      schema: dataEnvelope(allocationResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getPortfolioAttribution",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/analytics/attribution",
    tag: "Analytics",
    summary: "Get the attribution of a portfolio",
    description:
      "Without `period`, `from`, `to` or `groupBy` it is the current-state attribution; with any of them it is the attribution over that range, grouped by `asset` (default) or `assetType`.",
    authenticated: true,
    params: portfolioIdParamsSchema,
    query: attributionQuerySchema,
    success: {
      status: 200,
      description: "The current-state attribution, or the range attribution.",
      schema: dataEnvelope(z.union([attributionResponseSchema, rangeAttributionResponseSchema])),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getPortfolioRisk",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/analytics/risk",
    tag: "Analytics",
    summary: "Get the risk metrics of a portfolio",
    authenticated: true,
    params: portfolioIdParamsSchema,
    query: analyticsPeriodQuerySchema,
    success: {
      status: 200,
      description: "The risk metrics over the period.",
      schema: dataEnvelope(riskResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getPortfolioPerformance",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/analytics/performance",
    tag: "Analytics",
    summary: "Get the performance of a portfolio",
    authenticated: true,
    params: portfolioIdParamsSchema,
    query: analyticsPeriodQuerySchema,
    success: {
      status: 200,
      description: "The performance over the period.",
      schema: dataEnvelope(performanceResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
];

/** The watchlist and the user's preferences (07-api-spec.md §27-§29). */
export const userOperations: readonly ApiOperation[] = [
  {
    operationId: "listWatchlist",
    method: "get",
    path: "/api/v1/watchlist",
    tag: "Watchlist",
    summary: "List the watchlist",
    authenticated: true,
    success: {
      status: 200,
      description: "The assets the user watches.",
      schema: dataEnvelope(z.array(watchlistItemResponseSchema)),
    },
    errors: [401, 403, 429],
  },
  {
    operationId: "addToWatchlist",
    method: "post",
    path: "/api/v1/watchlist",
    tag: "Watchlist",
    summary: "Add an asset to the watchlist",
    description: "An asset that is already on the list is a 400.",
    authenticated: true,
    body: addWatchlistItemRequestSchema,
    success: {
      status: 201,
      description: "The watchlist entry.",
      schema: dataEnvelope(watchlistItemResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "removeFromWatchlist",
    method: "delete",
    path: "/api/v1/watchlist/:assetId",
    tag: "Watchlist",
    summary: "Remove an asset from the watchlist",
    authenticated: true,
    params: assetIdParamsSchema,
    success: { status: 204, description: "The asset was removed." },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getPreferences",
    method: "get",
    path: "/api/v1/preferences",
    tag: "Preferences",
    summary: "Get the user's preferences",
    description: "`data` is `null` until the user saves a preference for the first time.",
    authenticated: true,
    success: {
      status: 200,
      description: "The preferences, or null.",
      schema: dataEnvelope(userPreferenceResponseSchema.nullable()),
    },
    errors: [401, 403, 429],
  },
  {
    operationId: "updatePreferences",
    method: "patch",
    path: "/api/v1/preferences",
    tag: "Preferences",
    summary: "Update the user's preferences",
    description:
      "At least one field is required. A `defaultPortfolioId` must be a portfolio of the user.",
    authenticated: true,
    body: updateUserPreferenceRequestSchema,
    success: {
      status: 200,
      description: "The preferences after the change.",
      schema: dataEnvelope(userPreferenceResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
];
