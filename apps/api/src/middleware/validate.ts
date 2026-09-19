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
      };
    }
  }
}

type ValidationSource = "query" | "body";

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
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(source === "query" ? req.query : req.body);

    if (!parsed.success) {
      next(
        new AppError(
          "VALIDATION_ERROR",
          source === "query"
            ? "The request contains invalid query parameters."
            : "The request contains invalid fields.",
          400,
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
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
}
