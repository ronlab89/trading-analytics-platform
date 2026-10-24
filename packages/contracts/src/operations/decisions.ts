import { z } from "zod";
import type { ApiOperation } from "../api-operation.js";
import { decisionReplayResponseSchema } from "../decision-replay.response.js";
import { decisionResponseSchema } from "../decision.response.js";
import { listDecisionsQuerySchema } from "../decision.schema.js";
import {
  decisionIdParamsSchema,
  portfolioDecisionParamsSchema,
  portfolioIdParamsSchema,
} from "../params.schema.js";
import { dataEnvelope } from "../response-common.schema.js";

/** Decisions and their replay (07-api-spec.md §23-§24). */
export const decisionOperations: readonly ApiOperation[] = [
  {
    operationId: "listDecisions",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/decisions",
    tag: "Decisions",
    summary: "List the decisions of a portfolio",
    authenticated: true,
    params: portfolioIdParamsSchema,
    query: listDecisionsQuerySchema,
    success: {
      status: 200,
      description: "The decisions of the portfolio.",
      schema: dataEnvelope(z.array(decisionResponseSchema)),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getDecision",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/decisions/:decisionId",
    tag: "Decisions",
    summary: "Get a decision",
    authenticated: true,
    params: portfolioDecisionParamsSchema,
    success: {
      status: 200,
      description: "The decision.",
      schema: dataEnvelope(decisionResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getDecisionReplay",
    method: "get",
    path: "/api/v1/decisions/:decisionId/replay",
    tag: "Decisions",
    summary: "Replay a decision",
    description:
      "Not nested under a portfolio: ownership is resolved from the decision to its portfolio and user.",
    authenticated: true,
    params: decisionIdParamsSchema,
    success: {
      status: 200,
      description: "The events and states of the decision.",
      schema: dataEnvelope(decisionReplayResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
];
