export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "DEPENDENCY_ERROR"
  | "INTERNAL_ERROR";

export interface AppErrorDetail {
  field?: string;
  code?: string;
  message: string;
}

/**
 * Base application error. Thrown by controllers/services and translated
 * into a normalized HTTP response by the error-handling middleware.
 *
 * See 07-api-spec.md §5-6 and 13-observability-spec.md §12.2 for the
 * error category catalog this class is expected to represent.
 */
export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly statusCode: number;
  public readonly details?: AppErrorDetail[];

  constructor(code: AppErrorCode, message: string, statusCode: number, details?: AppErrorDetail[]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details ?? [];
  }
}
