import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/app-error.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * Populated by `validate()` with the Zod-parsed output for each
       * source it was run against. Controllers read from here instead
       * of re-parsing `req.query`/`req.body`, casting to the schema's
       * inferred type (same trust boundary the inline `parsed.data`
       * reads had before this middleware existed).
       */
      validated?: {
        query?: unknown;
        body?: unknown;
        params?: unknown;
      };
    }
  }
}

type ValidationSource = "query" | "body" | "params";

/**
 * What a `validate()` middleware checks. It is attached to the middleware
 * function so the test that compares the routes with the OpenAPI operations
 * can read it from the router (B6.4).
 */
export interface Validation {
  readonly schema: ZodType;
  readonly source: ValidationSource;
}

const SOURCE_MESSAGES: Record<ValidationSource, string> = {
  query: "The request contains invalid query parameters.",
  body: "The request contains invalid fields.",
  params: "The request contains invalid route parameters.",
};

/**
 * Generic request-validation middleware. Runs `schema.safeParse` against
 * `req[source]` and either:
 *   - on failure: forwards a VALIDATION_ERROR AppError with one detail
 *     per Zod issue, matching the shape every route built inline before
 *     this middleware existed (07-api-spec.md §5-6).
 *   - on success: stores the parsed (and possibly coerced/defaulted)
 *     data on `req.validated[source]` and calls `next()`.
 *
 * Deliberately does not overwrite `req.query`/`req.body` directly —
 * Express's built-in types for those are narrower than a schema's
 * parsed output (e.g. coerced numbers, applied `.default()` values),
 * so writing back through `req.validated` avoids fighting the type
 * system at the call site.
 */
export function validate(schema: ZodType, source: ValidationSource) {
  const middleware = (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[source]);

    if (!parsed.success) {
      next(
        new AppError(
          "VALIDATION_ERROR",
          SOURCE_MESSAGES[source],
          400,
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            code: issue.code,
            message: issue.message,
          })),
        ),
      );
      return;
    }

    req.validated ??= {};
    req.validated[source] = parsed.data;
    next();
  };
  return Object.assign(middleware, { validation: { schema, source } satisfies Validation });
}

/** The schema and source a middleware validates, or `undefined` when it is not a `validate()` one. */
export function validationOf(handler: unknown): Validation | undefined {
  return typeof handler === "function" && "validation" in handler
    ? (handler.validation as Validation)
    : undefined;
}
