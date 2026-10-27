import type { ApiOperation, ErrorCode, ErrorDetail } from "@trading/contracts";

/** Codes the client raises itself; the API never sends them (ADR-002 point 10). */
export type ClientErrorCode = "NETWORK_ERROR" | "TIMEOUT" | "INVALID_RESPONSE";

/** Every failure of a call: an API error envelope or a client-side failure. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | ClientErrorCode,
    message: string,
    readonly status?: number,
    readonly requestId?: string,
    readonly details?: readonly ErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface CallInput {
  readonly params?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly body?: unknown;
  /** Makes a creation safe to retry (ADR-008 point 8). */
  readonly idempotencyKey?: string;
}

/**
 * The only way the UI reaches the application (ADR-002 point 5). The HTTP
 * adapter sends the operation to the API; the demo adapter runs it in process.
 * A success is returned already validated against `operation.success.schema`.
 */
export interface TradingClient {
  call(operation: ApiOperation, input?: CallInput): Promise<unknown>;
}
