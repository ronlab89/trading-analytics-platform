import type { ZodType } from "zod";

/**
 * One HTTP endpoint described as plain data (ADR-002 point 7).
 *
 * The operations are the single description of the HTTP surface: the OpenAPI
 * document is generated from them and a test compares them with the routes
 * the API mounts. They reference the schemas the routes already validate
 * with, so nothing is written twice. This module has no Express dependency.
 */

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

/** Statuses an operation can declare; each answers with the shared error envelope. */
export const ERROR_STATUSES = [400, 401, 403, 404, 409, 413, 429, 500] as const;
export type ErrorStatus = (typeof ERROR_STATUSES)[number];

export interface ApiOperation {
  /** Unique, stable name, for example `listAlerts`. */
  readonly operationId: string;
  readonly method: HttpMethod;
  /** The path as Express mounts it, for example `/api/v1/alerts/:alertId`. */
  readonly path: string;
  /** Groups operations in the document, for example `Alerts`. */
  readonly tag: string;
  readonly summary: string;
  readonly description?: string;
  /** Whether the route sits behind the bearer access token. */
  readonly authenticated: boolean;
  /** Object schemas: each key becomes a path, query or header parameter. */
  readonly params?: ZodType;
  readonly query?: ZodType;
  readonly headers?: ZodType;
  /** Cookies the request reads; each key becomes a cookie parameter. */
  readonly cookies?: ZodType;
  readonly body?: ZodType;
  /** Media type of `body`; JSON when omitted. */
  readonly bodyContentType?: string;
  readonly success: {
    readonly status: number;
    readonly description: string;
    /** Response headers the success answer sets, as name and description. */
    readonly headers?: Readonly<Record<string, string>>;
    /** Omitted for a response with no body, such as a 204. */
    readonly schema?: ZodType;
  };
  /** Answers that are neither the success nor the shared error envelope, such as a 503 health body. */
  readonly otherResponses?: readonly {
    readonly status: number;
    readonly description: string;
    readonly schema: ZodType;
  }[];
  readonly errors: readonly ErrorStatus[];
}
