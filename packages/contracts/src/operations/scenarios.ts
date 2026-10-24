import { z } from "zod";
import type { ApiOperation } from "../api-operation.js";
import { portfolioIdParamsSchema, portfolioScenarioParamsSchema } from "../params.schema.js";
import { dataEnvelope } from "../response-common.schema.js";
import { archiveScenarioResponseSchema, scenarioResponseSchema } from "../scenario.response.js";
import {
  scenarioCalculationResponseSchema,
  scenarioComparisonResponseSchema,
} from "../scenario-impact.response.js";
import {
  compareScenariosRequestSchema,
  createScenarioRequestSchema,
  listScenariosQuerySchema,
  updateScenarioRequestSchema,
} from "../scenario.schema.js";

/** Scenarios, their calculation and comparison (07-api-spec.md §25-§26). */
export const scenarioOperations: readonly ApiOperation[] = [
  {
    operationId: "listScenarios",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/scenarios",
    tag: "Scenarios",
    summary: "List the scenarios of a portfolio",
    authenticated: true,
    params: portfolioIdParamsSchema,
    query: listScenariosQuerySchema,
    success: {
      status: 200,
      description: "The scenarios of the portfolio.",
      schema: dataEnvelope(z.array(scenarioResponseSchema)),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "createScenario",
    method: "post",
    path: "/api/v1/portfolios/:portfolioId/scenarios",
    tag: "Scenarios",
    summary: "Create a scenario",
    description: "An archived portfolio cannot be modified.",
    authenticated: true,
    params: portfolioIdParamsSchema,
    body: createScenarioRequestSchema,
    success: {
      status: 201,
      description: "The scenario that was created.",
      schema: dataEnvelope(scenarioResponseSchema),
    },
    errors: [400, 401, 403, 404, 409, 429],
  },
  {
    operationId: "compareScenarios",
    method: "post",
    path: "/api/v1/portfolios/:portfolioId/scenarios/compare",
    tag: "Scenarios",
    summary: "Compare several scenarios",
    description: "Compares up to 5 scenarios of the portfolio. It changes nothing.",
    authenticated: true,
    params: portfolioIdParamsSchema,
    body: compareScenariosRequestSchema,
    success: {
      status: 200,
      description: "The impact of each scenario side by side.",
      schema: dataEnvelope(scenarioComparisonResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getScenario",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId",
    tag: "Scenarios",
    summary: "Get a scenario",
    authenticated: true,
    params: portfolioScenarioParamsSchema,
    success: {
      status: 200,
      description: "The scenario.",
      schema: dataEnvelope(scenarioResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "updateScenario",
    method: "patch",
    path: "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId",
    tag: "Scenarios",
    summary: "Update a scenario",
    description:
      "An archived scenario, or a scenario of an archived portfolio, cannot be modified.",
    authenticated: true,
    params: portfolioScenarioParamsSchema,
    body: updateScenarioRequestSchema,
    success: {
      status: 200,
      description: "The scenario after the change.",
      schema: dataEnvelope(scenarioResponseSchema),
    },
    errors: [400, 401, 403, 404, 409, 429],
  },
  {
    operationId: "deleteScenario",
    method: "delete",
    path: "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId",
    tag: "Scenarios",
    summary: "Delete a scenario",
    description: "A scenario of an archived portfolio cannot be deleted.",
    authenticated: true,
    params: portfolioScenarioParamsSchema,
    success: { status: 204, description: "The scenario was deleted." },
    errors: [400, 401, 403, 404, 409, 429],
  },
  {
    operationId: "archiveScenario",
    method: "post",
    path: "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId/archive",
    tag: "Scenarios",
    summary: "Archive a scenario",
    description:
      "Idempotent: archiving an archived scenario answers 200 and sets `meta.alreadyArchived`.",
    authenticated: true,
    params: portfolioScenarioParamsSchema,
    success: {
      status: 200,
      description: "The archived scenario.",
      schema: archiveScenarioResponseSchema,
    },
    errors: [400, 401, 403, 404, 409, 429],
  },
  {
    operationId: "calculateScenario",
    method: "post",
    path: "/api/v1/portfolios/:portfolioId/scenarios/:scenarioId/calculate",
    tag: "Scenarios",
    summary: "Calculate the impact of a scenario",
    description: "Reads the portfolio and the scenario and stores nothing.",
    authenticated: true,
    params: portfolioScenarioParamsSchema,
    success: {
      status: 200,
      description: "The impact of the scenario on the portfolio.",
      schema: dataEnvelope(scenarioCalculationResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
];
