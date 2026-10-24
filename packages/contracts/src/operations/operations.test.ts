import { describe, expect, it } from "vitest";
import { toJSONSchema } from "zod";
import type { ZodType } from "zod";
import { buildOpenApiDocument } from "../openapi.js";
import { API_OPERATIONS } from "./index.js";

/**
 * Rules every described endpoint has to follow, whatever resource it belongs
 * to. They run over the whole registry, so a block that adds operations is
 * checked without writing new tests.
 */

function keysOf(schema: ZodType | undefined): string[] {
  if (schema === undefined) {
    return [];
  }
  const { properties } = toJSONSchema(schema, { io: "input" }) as {
    properties?: Record<string, unknown>;
  };
  return Object.keys(properties ?? {});
}

function pathParameters(path: string): string[] {
  return path
    .split("/")
    .filter((segment) => segment.startsWith(":"))
    .map((segment) => segment.slice(1));
}

describe("API_OPERATIONS", () => {
  it("is not empty", () => {
    expect(API_OPERATIONS.length).toBeGreaterThan(0);
  });

  it("gives every operation its own id, and its own method and path", () => {
    const ids = API_OPERATIONS.map((operation) => operation.operationId);
    const routes = API_OPERATIONS.map((operation) => `${operation.method} ${operation.path}`);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("keeps every path under /api/v1", () => {
    for (const operation of API_OPERATIONS) {
      expect(operation.path, operation.operationId).toMatch(/^\/api\/v1\//);
    }
  });

  it("describes exactly the path parameters that the path names", () => {
    for (const operation of API_OPERATIONS) {
      expect(keysOf(operation.params).sort(), operation.operationId).toEqual(
        pathParameters(operation.path).sort(),
      );
    }
  });

  it("answers 401 on every private operation, and on no public one", () => {
    for (const operation of API_OPERATIONS) {
      expect(operation.errors.includes(401), operation.operationId).toBe(operation.authenticated);
    }
  });

  it("answers 400 on every operation that validates a request, and on no other", () => {
    for (const operation of API_OPERATIONS) {
      const validates =
        operation.params !== undefined ||
        operation.query !== undefined ||
        operation.headers !== undefined ||
        operation.body !== undefined;

      expect(operation.errors.includes(400), operation.operationId).toBe(validates);
    }
  });

  it("describes a body for every success except a 204", () => {
    for (const operation of API_OPERATIONS) {
      const { status, schema } = operation.success;

      expect(schema === undefined, operation.operationId).toBe(status === 204);
    }
  });

  it("builds into a document with one path item per path", () => {
    const document = buildOpenApiDocument(API_OPERATIONS, { title: "Trading API", version: "1" });
    const paths = Object.keys(document.paths as object);

    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((path) => !path.includes(":"))).toBe(true);
  });
});
