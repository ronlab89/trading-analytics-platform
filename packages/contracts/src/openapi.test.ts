/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/dot-notation --
   The tests read a generated JSON document by path, so its nodes are untyped on purpose. */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ApiOperation } from "./api-operation.js";
import { alertResponseSchema } from "./alert.response.js";
import { listNotificationsQuerySchema } from "./notification.schema.js";
import { notificationResponseSchema } from "./notification.response.js";
import { alertIdParamsSchema } from "./params.schema.js";
import { dataEnvelope, pageEnvelope } from "./response-common.schema.js";
import { buildOpenApiDocument } from "./openapi.js";

const getAlert: ApiOperation = {
  operationId: "getAlert",
  method: "get",
  path: "/api/v1/alerts/:alertId",
  tag: "Alerts",
  summary: "Get an alert",
  authenticated: true,
  params: alertIdParamsSchema,
  success: {
    status: 200,
    description: "The alert.",
    schema: dataEnvelope(alertResponseSchema),
  },
  errors: [401, 404],
};

const listNotifications: ApiOperation = {
  operationId: "listNotifications",
  method: "get",
  path: "/api/v1/notifications",
  tag: "Notifications",
  summary: "List notifications",
  authenticated: true,
  query: listNotificationsQuerySchema,
  success: {
    status: 200,
    description: "A page of notifications.",
    schema: pageEnvelope(notificationResponseSchema),
  },
  errors: [400, 401],
};

const deleteAlert: ApiOperation = {
  operationId: "deleteAlert",
  method: "delete",
  path: "/api/v1/alerts/:alertId",
  tag: "Alerts",
  summary: "Delete an alert",
  authenticated: true,
  params: alertIdParamsSchema,
  success: { status: 204, description: "The alert was deleted." },
  errors: [401, 404],
};

const createThing: ApiOperation = {
  operationId: "createThing",
  method: "post",
  path: "/api/v1/things",
  tag: "Things",
  summary: "Create a thing",
  authenticated: false,
  body: z.object({ name: z.string().min(1), size: z.number().default(1) }),
  success: {
    status: 201,
    description: "Created.",
    schema: dataEnvelope(z.object({ id: z.string() })),
  },
  errors: [400, 429],
};

const importCsv: ApiOperation = {
  operationId: "importCsv",
  method: "post",
  path: "/api/v1/things/imports",
  tag: "Things",
  summary: "Import a CSV",
  authenticated: true,
  headers: z.object({ "Idempotency-Key": z.string().min(1).optional() }),
  body: z.string(),
  bodyContentType: "text/csv",
  success: {
    status: 202,
    description: "Accepted.",
    headers: { Location: "Where to follow the job." },
  },
  errors: [429],
};

const info = { title: "Trading API", version: "1.0.0" };

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function build(operations: ApiOperation[]): Json {
  return buildOpenApiDocument(operations, info);
}

describe("buildOpenApiDocument", () => {
  it("declares OpenAPI 3.1, the info and the bearer scheme", () => {
    const document = build([getAlert]);

    expect(document["openapi"]).toBe("3.1.0");
    expect(document["info"]).toEqual(info);
    expect(document["components"].securitySchemes.bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  });

  it("adds a server only when one is given", () => {
    expect(build([getAlert])["servers"]).toBeUndefined();
    const withServer = buildOpenApiDocument([getAlert], {
      ...info,
      serverUrl: "http://localhost:7001",
    });
    expect(withServer["servers"]).toEqual([{ url: "http://localhost:7001" }]);
  });

  it("turns an Express path into an OpenAPI path with a required path parameter", () => {
    const operation = build([getAlert])["paths"]["/api/v1/alerts/{alertId}"].get;

    expect(operation.operationId).toBe("getAlert");
    expect(operation.tags).toEqual(["Alerts"]);
    expect(operation.parameters).toEqual([
      expect.objectContaining({ name: "alertId", in: "path", required: true }),
    ]);
  });

  it("describes a single item as the data envelope of the response schema", () => {
    const schema = build([getAlert])["paths"]["/api/v1/alerts/{alertId}"].get.responses["200"]
      .content["application/json"].schema;

    expect(schema.required).toEqual(["data"]);
    expect(schema.properties.data.properties).toHaveProperty("threshold");
    expect(schema).not.toHaveProperty("$schema");
  });

  it("describes a list with its page meta and the query parameters", () => {
    const operation = build([listNotifications])["paths"]["/api/v1/notifications"].get;
    const schema = operation.responses["200"].content["application/json"].schema;

    expect(schema.properties.data.type).toBe("array");
    expect(schema.properties.meta.properties).toHaveProperty("totalPages");
    expect(operation.parameters).toEqual([
      expect.objectContaining({ name: "unreadOnly", in: "query", required: false }),
    ]);
  });

  it("describes a 204 with no body", () => {
    const response = build([deleteAlert])["paths"]["/api/v1/alerts/{alertId}"].delete.responses[
      "204"
    ];

    expect(response).toEqual({ description: "The alert was deleted." });
  });

  it("puts operations that share a path under the same path item", () => {
    const item = build([getAlert, deleteAlert])["paths"]["/api/v1/alerts/{alertId}"];

    expect(Object.keys(item as object).sort()).toEqual(["delete", "get"]);
  });

  it("references the shared error envelope for every declared error status", () => {
    const document = build([getAlert]);
    const responses = document["paths"]["/api/v1/alerts/{alertId}"].get.responses;

    expect(Object.keys(responses as object).sort()).toEqual(["200", "401", "404"]);
    expect(responses["404"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/ErrorResponse",
    });
    expect(
      document["components"].schemas.ErrorResponse.properties.error.properties.code.enum,
    ).toContain("VALIDATION_ERROR");
  });

  it("requires the token on a private operation and none on a public one", () => {
    const document = build([getAlert, createThing]);

    expect(document["paths"]["/api/v1/alerts/{alertId}"].get.security).toEqual([
      { bearerAuth: [] },
    ]);
    expect(document["paths"]["/api/v1/things"].post.security).toEqual([]);
  });

  it("describes a request body, leaving a defaulted field optional", () => {
    const body = build([createThing])["paths"]["/api/v1/things"].post.requestBody;

    expect(body.required).toBe(true);
    expect(body.content["application/json"].schema.required).toEqual(["name"]);
  });

  it("refuses two operations with the same id or the same method and path", () => {
    expect(() => build([getAlert, { ...deleteAlert, operationId: "getAlert" }])).toThrow(
      "Duplicate operationId: getAlert",
    );
    expect(() => build([getAlert, { ...getAlert, operationId: "getAlertAgain" }])).toThrow(
      "Duplicate operation: GET /api/v1/alerts/:alertId",
    );
  });

  it("describes a header parameter, a body with another media type and a success header", () => {
    const operation = build([importCsv])["paths"]["/api/v1/things/imports"].post;

    expect(operation.parameters).toEqual([
      expect.objectContaining({ name: "Idempotency-Key", in: "header", required: false }),
    ]);
    expect(Object.keys(operation.requestBody.content as object)).toEqual(["text/csv"]);
    expect(operation.responses["202"].headers.Location).toEqual({
      description: "Where to follow the job.",
      schema: { type: "string" },
    });
  });

  it("adds Retry-After to a 429 answer and to no other", () => {
    const responses = build([importCsv, getAlert])["paths"];

    expect(
      responses["/api/v1/things/imports"].post.responses["429"].headers["Retry-After"],
    ).toEqual(expect.objectContaining({ schema: { type: "integer" } }));
    expect(responses["/api/v1/alerts/{alertId}"].get.responses["404"].headers).toBeUndefined();
  });
});
