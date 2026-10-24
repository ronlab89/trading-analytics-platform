import type { Express } from "express";
import type { ApiOperation, HttpMethod } from "@trading/contracts";
import { authenticate } from "../middleware/authenticate.js";
import { validationOf } from "../middleware/validate.js";

/** One route as the app mounts it: its method, its full path and its handlers in order. */
export interface MountedRoute {
  readonly method: HttpMethod;
  readonly path: string;
  readonly handlers: readonly unknown[];
}

// The parts of Express's internal routing table the walk reads. Express does
// not type them, so they are declared here and the table is cast once.
interface Layer {
  readonly handle: unknown;
  readonly route?: {
    readonly path: string;
    readonly methods: Readonly<Record<string, boolean>>;
    readonly stack: readonly { readonly handle: unknown }[];
  };
}

interface RouterLike {
  readonly stack: readonly Layer[];
}

function isRouterLike(value: unknown): value is RouterLike {
  return typeof value === "function" && "stack" in value && Array.isArray(value.stack);
}

function collect(stack: readonly Layer[], routes: MountedRoute[]): void {
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        routes.push({
          method: method as HttpMethod,
          path: layer.route.path,
          handlers: layer.route.stack.map((entry) => entry.handle),
        });
      }
    } else if (isRouterLike(layer.handle)) {
      collect(layer.handle.stack, routes);
    }
  }
}

/** Walks the routing table of the app and lists every route it mounts. */
export function readMountedRoutes(app: Express): MountedRoute[] {
  const routes: MountedRoute[] = [];
  collect((app.router as unknown as RouterLike).stack, routes);
  return routes;
}

const SOURCES = ["params", "query", "body"] as const;

function describe(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/**
 * Compares the mounted routes with the operations and returns one message per
 * difference, each naming the route and what to fix (ADR-002 point 7). An
 * empty list means the OpenAPI document describes the API the app serves.
 */
export function findDrift(
  routes: readonly MountedRoute[],
  operations: readonly ApiOperation[],
): string[] {
  const problems: string[] = [];
  const operationsByRoute = new Map(
    operations.map((operation) => [describe(operation.method, operation.path), operation]),
  );
  const mounted = new Set<string>();

  for (const route of routes) {
    const key = describe(route.method, route.path);
    mounted.add(key);
    const operation = operationsByRoute.get(key);

    if (!operation) {
      problems.push(`${key}: the route is mounted but has no operation in API_OPERATIONS`);
      continue;
    }

    const isAuthenticated = route.handlers.includes(authenticate);
    if (isAuthenticated !== operation.authenticated) {
      problems.push(
        `${key}: the route ${isAuthenticated ? "requires" : "does not require"} the access token but operation "${operation.operationId}" has authenticated: ${String(operation.authenticated)}`,
      );
    }

    for (const source of SOURCES) {
      const schemas = route.handlers
        .map(validationOf)
        .filter((validation) => validation?.source === source)
        .map((validation) => validation?.schema);
      const described = operation[source];

      if (schemas.length === 0) {
        // A body with its own media type (the CSV import) is read raw, not validated.
        const isRawBody = source === "body" && operation.bodyContentType !== undefined;
        if (described && !isRawBody) {
          problems.push(
            `${key}: operation "${operation.operationId}" describes ${source} but the route does not validate it`,
          );
        }
      } else if (!described) {
        problems.push(
          `${key}: the route validates ${source} but operation "${operation.operationId}" does not describe it`,
        );
      } else if (schemas.some((schema) => schema !== described)) {
        problems.push(
          `${key}: the ${source} schema of the route is not the one of operation "${operation.operationId}"`,
        );
      }
    }
  }

  for (const operation of operations) {
    const key = describe(operation.method, operation.path);
    if (!mounted.has(key)) {
      problems.push(
        `${key}: operation "${operation.operationId}" has no mounted route in createApp()`,
      );
    }
  }

  return problems;
}
