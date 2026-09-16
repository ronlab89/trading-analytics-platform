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
 * Central error-handling middleware. Must be registered last, after all
 * routes. Normalizes both known AppErrors and unexpected exceptions into
 * the response shape defined in 07-api-spec.md §5, and never leaks stack
 * traces, internal messages, or dependency details to the client
 * (09-security-spec.md §28).
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
