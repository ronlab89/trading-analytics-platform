import { describe, expect, it } from "vitest";
import { z } from "zod";
import { API_OPERATIONS } from "@trading/contracts";
import type { ApiOperation } from "@trading/contracts";
import { createApp } from "./app.js";
import { authenticate } from "./middleware/authenticate.js";
import { validate } from "./middleware/validate.js";
import { findDrift, readMountedRoutes } from "./test-utils/openapi-drift.js";
import type { MountedRoute } from "./test-utils/openapi-drift.js";

/**
 * ADR-002 point 7: the OpenAPI document is generated from API_OPERATIONS, so
 * this test keeps those operations equal to the routes `createApp()` mounts.
 * It reads the routing table and sends no request, so it needs no database.
 */
describe("the OpenAPI operations against the mounted routes", () => {
  it("describe exactly the routes the app mounts, with the same schemas and authentication", () => {
    // The docs routes (/openapi.json, /api/docs) are not API routes and are not operations.
    const routes = readMountedRoutes(createApp({ docsEnabled: false }));

    expect(routes.length).toBeGreaterThan(0);
    expect(findDrift(routes, API_OPERATIONS)).toEqual([]);
  });
});

describe("findDrift", () => {
  const params = z.object({ itemId: z.string() });
  const query = z.object({ page: z.string().optional() });
  const body = z.object({ name: z.string() });

  const operation: ApiOperation = {
    operationId: "updateItem",
    method: "patch",
    path: "/api/v1/items/:itemId",
    tag: "Items",
    summary: "Update an item",
    authenticated: true,
    params,
    query,
    body,
    success: { status: 200, description: "The item." },
    errors: [400, 401, 429],
  };

  const route: MountedRoute = {
    method: "patch",
    path: "/api/v1/items/:itemId",
    handlers: [
      authenticate,
      validate(params, "params"),
      validate(query, "query"),
      validate(body, "body"),
      () => undefined,
    ],
  };

  it("finds nothing when the route and the operation agree", () => {
    expect(findDrift([route], [operation])).toEqual([]);
  });

  it("names a mounted route that has no operation", () => {
    expect(findDrift([route], [])).toEqual([
      "PATCH /api/v1/items/:itemId: the route is mounted but has no operation in API_OPERATIONS",
    ]);
  });

  it("names an operation that has no mounted route", () => {
    expect(findDrift([], [operation])).toEqual([
      'PATCH /api/v1/items/:itemId: operation "updateItem" has no mounted route in createApp()',
    ]);
  });

  it("reports a method that differs as a missing route and a missing operation", () => {
    const problems = findDrift([route], [{ ...operation, method: "put" }]);

    expect(problems).toHaveLength(2);
    expect(problems.join("\n")).toContain("PATCH /api/v1/items/:itemId: the route is mounted");
    expect(problems.join("\n")).toContain('PUT /api/v1/items/:itemId: operation "updateItem"');
  });

  it("reports a path that differs", () => {
    const problems = findDrift([route], [{ ...operation, path: "/api/v1/items/:id" }]);

    expect(problems).toHaveLength(2);
  });

  it("reports a route behind the token whose operation says it is public, and the reverse", () => {
    expect(findDrift([route], [{ ...operation, authenticated: false }])).toEqual([
      'PATCH /api/v1/items/:itemId: the route requires the access token but operation "updateItem" has authenticated: false',
    ]);

    const publicRoute = { ...route, handlers: route.handlers.slice(1) };
    expect(findDrift([publicRoute], [operation])).toEqual([
      'PATCH /api/v1/items/:itemId: the route does not require the access token but operation "updateItem" has authenticated: true',
    ]);
  });

  it("reports a validated schema that is a different object from the operation's", () => {
    const copy = z.object({ name: z.string() });

    expect(findDrift([route], [{ ...operation, body: copy }])).toEqual([
      'PATCH /api/v1/items/:itemId: the body schema of the route is not the one of operation "updateItem"',
    ]);
  });

  it("reports a validation the operation does not describe, and the reverse", () => {
    const { query: _query, ...withoutQuery } = operation;

    expect(findDrift([route], [withoutQuery])).toEqual([
      'PATCH /api/v1/items/:itemId: the route validates query but operation "updateItem" does not describe it',
    ]);

    const unvalidated = { ...route, handlers: [authenticate, () => undefined] };
    expect(findDrift([unvalidated], [operation]).join("\n")).toContain(
      'operation "updateItem" describes params but the route does not validate it',
    );
  });

  it("accepts a raw body with its own media type that the route does not validate", () => {
    const csv = { ...operation, bodyContentType: "text/csv" };
    const unvalidatedBody = {
      ...route,
      handlers: [authenticate, validate(params, "params"), validate(query, "query")],
    };

    expect(findDrift([unvalidatedBody], [csv])).toEqual([]);
  });
});
