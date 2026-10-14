import type { NextFunction, Request, Response } from "express";
import { ConflictError, ForbiddenError, NotFoundError } from "@trading/application";
import type { ErrorResponse } from "@trading/contracts";
import { AppError } from "../errors/app-error.js";

type ErrorResponseBody = ErrorResponse;

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
 * Database-unreachable failures from the Prisma client, duck-typed on
 * `name`/`code` so the middleware does not import Prisma:
 * P1001 unreachable, P1002 timed out, P1008 operation timed out,
 * P1017 server closed the connection.
 */
const DEPENDENCY_ERROR_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

function isDependencyError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "PrismaClientInitializationError") return true;
  return "code" in err && typeof err.code === "string" && DEPENDENCY_ERROR_CODES.has(err.code);
}

function mapApplicationError(
  err: unknown,
): { status: number; code: ErrorResponse["error"]["code"]; message: string } | null {
  if (err instanceof NotFoundError) {
    return { status: 404, code: "NOT_FOUND", message: err.message };
  }
  if (err instanceof ConflictError) {
    return { status: 409, code: "CONFLICT", message: err.message };
  }
  if (err instanceof ForbiddenError) {
    return { status: 403, code: "FORBIDDEN", message: err.message };
  }
  return null;
}

function logRequestFailed(requestId: string, err: unknown): void {
  console.error(
    JSON.stringify({
      level: "error",
      event: "request.failed",
      requestId,
      errorName: err instanceof Error ? err.name : "UnknownError",
      message: err instanceof Error ? err.message : String(err),
    }),
  );
}

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

  // Use-case failures raised by `@trading/application`. They carry no HTTP
  // knowledge; this is the one place that gives them a status and a code.
  const applicationFailure = mapApplicationError(err);
  if (applicationFailure) {
    const body: ErrorResponseBody = {
      error: {
        code: applicationFailure.code,
        message: applicationFailure.message,
        requestId,
      },
    };
    res.status(applicationFailure.status).json(body);
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

  // Database unreachable: 503, fixed message, details only in the log.
  if (isDependencyError(err)) {
    logRequestFailed(requestId, err);
    const body: ErrorResponseBody = {
      error: {
        code: "DEPENDENCY_ERROR",
        message: "A required service is temporarily unavailable.",
        requestId,
      },
    };
    res.status(503).json(body);
    return;
  }

  // Unexpected/unclassified error: log full detail server-side only,
  // return a safe generic message to the client.
  logRequestFailed(requestId, err);

  const body: ErrorResponseBody = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId,
    },
  };
  res.status(500).json(body);
}
