import { z } from "zod";
import type { ApiOperation } from "../api-operation.js";
import { portfolioIdParamsSchema, portfolioPositionParamsSchema } from "../params.schema.js";
import { archivePortfolioResponseSchema, portfolioResponseSchema } from "../portfolio.response.js";
import { createPortfolioRequestSchema, updatePortfolioRequestSchema } from "../portfolio.schema.js";
import { positionDetailResponseSchema, positionResponseSchema } from "../position.response.js";
import { dataEnvelope } from "../response-common.schema.js";

/** Portfolios and their positions (07-api-spec.md §10-§12). */
export const portfolioOperations: readonly ApiOperation[] = [
  {
    operationId: "listPortfolios",
    method: "get",
    path: "/api/v1/portfolios",
    tag: "Portfolios",
    summary: "List the user's portfolios",
    authenticated: true,
    success: {
      status: 200,
      description: "The portfolios of the user.",
      schema: dataEnvelope(z.array(portfolioResponseSchema)),
    },
    errors: [401, 403, 429],
  },
  {
    operationId: "createPortfolio",
    method: "post",
    path: "/api/v1/portfolios",
    tag: "Portfolios",
    summary: "Create a portfolio",
    authenticated: true,
    body: createPortfolioRequestSchema,
    success: {
      status: 201,
      description: "The portfolio that was created.",
      schema: dataEnvelope(portfolioResponseSchema),
    },
    errors: [400, 401, 403, 429],
  },
  {
    operationId: "getPortfolio",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId",
    tag: "Portfolios",
    summary: "Get a portfolio",
    authenticated: true,
    params: portfolioIdParamsSchema,
    success: {
      status: 200,
      description: "The portfolio.",
      schema: dataEnvelope(portfolioResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "updatePortfolio",
    method: "patch",
    path: "/api/v1/portfolios/:portfolioId",
    tag: "Portfolios",
    summary: "Update a portfolio",
    description: "An archived portfolio cannot be modified.",
    authenticated: true,
    params: portfolioIdParamsSchema,
    body: updatePortfolioRequestSchema,
    success: {
      status: 200,
      description: "The portfolio after the change.",
      schema: dataEnvelope(portfolioResponseSchema),
    },
    errors: [400, 401, 403, 404, 409, 429],
  },
  {
    operationId: "archivePortfolio",
    method: "post",
    path: "/api/v1/portfolios/:portfolioId/archive",
    tag: "Portfolios",
    summary: "Archive a portfolio",
    description:
      "Idempotent: archiving an archived portfolio answers 200 and sets `meta.alreadyArchived`.",
    authenticated: true,
    params: portfolioIdParamsSchema,
    success: {
      status: 200,
      description: "The archived portfolio.",
      schema: archivePortfolioResponseSchema,
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "listPositions",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/positions",
    tag: "Positions",
    summary: "List the positions of a portfolio",
    authenticated: true,
    params: portfolioIdParamsSchema,
    success: {
      status: 200,
      description: "The positions of the portfolio.",
      schema: dataEnvelope(z.array(positionResponseSchema)),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getPosition",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/positions/:positionId",
    tag: "Positions",
    summary: "Get a position with its metrics",
    authenticated: true,
    params: portfolioPositionParamsSchema,
    success: {
      status: 200,
      description: "The position and its metrics.",
      schema: dataEnvelope(positionDetailResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
];
