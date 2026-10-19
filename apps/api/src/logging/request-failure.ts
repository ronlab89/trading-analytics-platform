import type { Request } from "express";
import type { ErrorCode } from "@trading/contracts";
import { LOG_EVENTS } from "./events.js";

/**
 * Level of the `http.request.failed` entry by error code (ADR-009 point 6).
 * Typed over every `ErrorCode`, so a new code cannot ship without a level.
 */
const LEVEL_BY_CODE: Record<ErrorCode, "info" | "warn" | "error"> = {
  VALIDATION_ERROR: "warn",
  UNAUTHORIZED: "warn",
  FORBIDDEN: "warn",
  RATE_LIMITED: "warn",
  NOT_FOUND: "info",
  CONFLICT: "info",
  DEPENDENCY_ERROR: "error",
  INTERNAL_ERROR: "error",
};

export interface RequestFailure {
  code: ErrorCode;
  status: number;
  /** What the client was told. */
  message: string;
  /** The thrown value; read only for the codes logged at `error`. */
  cause?: unknown;
}

/**
 * Writes the `http.request.failed` entry of one failed request. Codes logged
 * at `error` carry the raw message, `errorName` and the stack of the cause,
 * never the response (ADR-009 points 4 and 6); the others carry the message
 * the client received.
 */
export function logRequestFailure(req: Request, failure: RequestFailure): void {
  const level = LEVEL_BY_CODE[failure.code];
  const fields = {
    requestId: req.requestId,
    errorCategory: failure.code,
    status: failure.status,
  };

  if (level === "error") {
    const cause = failure.cause;
    req.logger.error(LOG_EVENTS.httpRequestFailed, {
      ...fields,
      message:
        cause instanceof Error
          ? cause.message
          : typeof cause === "string"
            ? cause
            : failure.message,
      errorName: cause instanceof Error ? cause.name : "UnknownError",
      stack: cause instanceof Error ? cause.stack : undefined,
    });
    return;
  }

  req.logger[level](LOG_EVENTS.httpRequestFailed, { ...fields, message: failure.message });
}
