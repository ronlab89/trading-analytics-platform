import { toJSONSchema } from "zod";
import type { ZodType } from "zod";
import { ERROR_STATUSES } from "./api-operation.js";
import type { ApiOperation, ErrorStatus } from "./api-operation.js";
import { errorResponseSchema } from "./error.schema.js";

/**
 * Builds the OpenAPI document from the operations (ADR-002 point 7).
 *
 * Every schema goes through Zod v4's `toJSONSchema` with the 2020-12 dialect,
 * which is the one OpenAPI 3.1 uses. The only hand-written parts are the
 * document info, the bearer security scheme and the status descriptions.
 */

type JsonObject = Record<string, unknown>;

export interface OpenApiInfo {
  readonly title: string;
  readonly version: string;
  readonly description?: string;
  /** Added as the only server when present. */
  readonly serverUrl?: string;
}

const ERROR_DESCRIPTIONS: Record<ErrorStatus, string> = {
  400: "The request is invalid.",
  401: "The access token is missing, invalid or expired.",
  403: "The user may not do this.",
  404: "The resource does not exist or is not the user's.",
  409: "The request conflicts with the current state.",
  413: "The request body is too large.",
  429: "Too many requests.",
  500: "Unexpected server error.",
};

const ERROR_REF = "#/components/schemas/ErrorResponse";
const BEARER = "bearerAuth";

/** One schema as JSON Schema; `input` for requests (defaults are optional), `output` for responses. */
function jsonSchema(schema: ZodType, io: "input" | "output"): JsonObject {
  const { $schema: _dialect, ...rest } = toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    unrepresentable: "any",
  }) as JsonObject;
  return rest;
}

/** `/api/v1/alerts/:alertId` becomes `/api/v1/alerts/{alertId}`. */
function openApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function parametersOf(schema: ZodType, location: "path" | "query"): JsonObject[] {
  const object = jsonSchema(schema, "input");
  const { properties = {}, required: requiredNames = [] } = object as {
    properties?: Record<string, JsonObject>;
    required?: string[];
  };
  const required = new Set(requiredNames);
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: location,
    required: location === "path" || required.has(name),
    schema: property,
  }));
}

function responsesOf(operation: ApiOperation): JsonObject {
  const { status, description, schema } = operation.success;
  const responses: JsonObject = {
    [String(status)]: {
      description,
      ...(schema === undefined
        ? {}
        : { content: { "application/json": { schema: jsonSchema(schema, "output") } } }),
    },
  };
  for (const errorStatus of ERROR_STATUSES) {
    if (operation.errors.includes(errorStatus)) {
      responses[String(errorStatus)] = {
        description: ERROR_DESCRIPTIONS[errorStatus],
        content: { "application/json": { schema: { $ref: ERROR_REF } } },
      };
    }
  }
  return responses;
}

function operationObject(operation: ApiOperation): JsonObject {
  const parameters = [
    ...(operation.params === undefined ? [] : parametersOf(operation.params, "path")),
    ...(operation.query === undefined ? [] : parametersOf(operation.query, "query")),
  ];
  return {
    operationId: operation.operationId,
    tags: [operation.tag],
    summary: operation.summary,
    ...(operation.description === undefined ? {} : { description: operation.description }),
    // An empty list marks a public operation, overriding any default.
    security: operation.authenticated ? [{ [BEARER]: [] }] : [],
    ...(parameters.length === 0 ? {} : { parameters }),
    ...(operation.body === undefined
      ? {}
      : {
          requestBody: {
            required: true,
            content: { "application/json": { schema: jsonSchema(operation.body, "input") } },
          },
        }),
    responses: responsesOf(operation),
  };
}

export function buildOpenApiDocument(
  operations: readonly ApiOperation[],
  info: OpenApiInfo,
): JsonObject {
  const seen = new Set<string>();
  const paths: Record<string, JsonObject> = {};
  for (const operation of operations) {
    if (seen.has(operation.operationId)) {
      throw new Error(`Duplicate operationId: ${operation.operationId}`);
    }
    seen.add(operation.operationId);

    const path = openApiPath(operation.path);
    const item = (paths[path] ??= {});
    if (item[operation.method] !== undefined) {
      throw new Error(`Duplicate operation: ${operation.method.toUpperCase()} ${operation.path}`);
    }
    item[operation.method] = operationObject(operation);
  }

  const tags = [...new Set(operations.map((operation) => operation.tag))].map((name) => ({
    name,
  }));

  return {
    openapi: "3.1.0",
    info: {
      title: info.title,
      version: info.version,
      ...(info.description === undefined ? {} : { description: info.description }),
    },
    ...(info.serverUrl === undefined ? {} : { servers: [{ url: info.serverUrl }] }),
    tags,
    paths,
    components: {
      securitySchemes: {
        [BEARER]: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: { ErrorResponse: jsonSchema(errorResponseSchema, "output") },
    },
  };
}
