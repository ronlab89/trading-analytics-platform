import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationFailedError,
} from "@trading/application";
import { ApiError } from "@/api/trading-client";

/**
 * Domain rules that were broken by the input (`InvalidPortfolioError`, `InsufficientPositionQuantityError`...),
 * recognised by the name like the API does, so the demo needs no list of classes (docs/06 error handling).
 */
const DOMAIN_VALIDATION_ERROR_NAME = /^(Invalid|Insufficient).+Error$/;

/**
 * Gives a failure of the application layer the code, status and message the API would answer, so the
 * screens meet the same `ApiError` in the demo as in real mode. Nothing internal reaches the user:
 * an error nobody planned for becomes a generic 500.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ValidationFailedError) {
    return new ApiError("VALIDATION_ERROR", error.message, 400, undefined, error.details);
  }
  if (error instanceof NotFoundError) return new ApiError("NOT_FOUND", error.message, 404);
  if (error instanceof ConflictError) return new ApiError("CONFLICT", error.message, 409);
  if (error instanceof ForbiddenError) return new ApiError("FORBIDDEN", error.message, 403);
  if (error instanceof Error && DOMAIN_VALIDATION_ERROR_NAME.test(error.name)) {
    return new ApiError("VALIDATION_ERROR", error.message, 400);
  }
  return new ApiError("INTERNAL_ERROR", "An unexpected error occurred.", 500);
}
