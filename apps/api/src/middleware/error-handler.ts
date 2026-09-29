import type { NextFunction, Request, Response } from "express";
import { AppError, type AppErrorDetail } from "../errors/app-error.js";

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: AppErrorDetail[];
    requestId: string;
  };
}

/**
 * Matches the naming convention used by domain-boundary errors across
 * `@trading/domain`:
 *   - Invalid*Error (e.g. InvalidPortfolioError, InvalidTransactionError,
 *     InvalidPositionError, ...) — structural/shape invariant violations.
 *   - Insufficient*Error (e.g. InsufficientPositionQuantityError) —
 *     business-rule violations that are still caused by malformed
 *     client input (e.g. selling more than is held), not server-side
 *     failures.
 *
 * Both categories represent "the request was invalid", so both
 * normalize to 400 VALIDATION_ERROR.
 *
 * Deliberately duck-typed on `err.name` rather than importing a shared
 * base class from `@trading/domain` — this keeps the error-handling
 * middleware infrastructure-agnostic and avoids introducing a new
 * cross-package coupling for a single normalization concern (NFR-070).
 * The convention already holds consistently for every entity today; if
 * that ever changes, a shared `DomainValidationError` base class would
 * be the natural next step.
 */
const DOMAIN_VALIDATION_ERROR_NAME = /^(Invalid|Insufficient).+Error$/;

function isDomainValidationError(err: unknown): err is Error {
  return err instanceof Error && DOMAIN_VALIDATION_ERROR_NAME.test(err.name);
}

/**
 * Errors raised by Express's body parser (`express.json()`), built with
 * `http-errors`: they carry a machine-readable `type` (e.g.
 * "entity.parse.failed", "entity.too.large") and an HTTP `status`.
 * Duck-typed for the same reason as the domain errors above: no extra
 * dependency in the error-handling middleware.
 */
interface BodyParserError extends Error {
  type: string;
  status: number;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return (
    err instanceof Error &&
    "type" in err &&
    typeof err.type === "string" &&
    err.type.startsWith("entity.") &&
    "status" in err &&
    typeof err.status === "number"
  );
}

const BODY_PARSER_MESSAGES: Record<string, string> = {
  "entity.parse.failed": "The request body is not valid JSON.",
  "entity.too.large": "The request body is too large.",
};

/**
 * Central error-handling middleware. Must be registered last, after all
 * routes. Normalizes AppErrors, domain invariant errors, and unexpected
 * exceptions into the response shape defined in 07-api-spec.md §5, and
 * never leaks stack traces, internal messages, or dependency details to
 * the client (09-security-spec.md §28).
 *
 * Express requires exactly 4 parameters for a handler to be recognized
 * as an error-handling middleware — do not remove unused `_next`.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    const body: ErrorResponseBody = {
      error: {
        code: err.code,
        message: err.message,
        requestId,
        ...(err.details ? { details: err.details } : {}),
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // Malformed or oversized request body, rejected by the body parser
  // before any route ran. Client error (400/413), never a 500.
  if (isBodyParserError(err)) {
    const body: ErrorResponseBody = {
      error: {
        code: "VALIDATION_ERROR",
        message: BODY_PARSER_MESSAGES[err.type] ?? "The request body could not be processed.",
        requestId,
      },
    };
    res.status(err.status >= 400 && err.status < 500 ? err.status : 400).json(body);
    return;
  }

  // Domain invariant violation (e.g. InvalidPortfolioError). These
  // represent malformed input caught at the domain boundary, not
  // unexpected failures — they always normalize to 400 VALIDATION_ERROR.
  if (isDomainValidationError(err)) {
    const body: ErrorResponseBody = {
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,
        requestId,
      },
    };
    res.status(400).json(body);
    return;
  }

  // Unexpected/unclassified error: log full detail server-side only,
  // return a safe generic message to the client.
  console.error(
    JSON.stringify({
      level: "error",
      event: "request.failed",
      requestId,
      errorName: err instanceof Error ? err.name : "UnknownError",
      message: err instanceof Error ? err.message : String(err),
    }),
  );

  const body: ErrorResponseBody = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId,
    },
  };
  res.status(500).json(body);
}
