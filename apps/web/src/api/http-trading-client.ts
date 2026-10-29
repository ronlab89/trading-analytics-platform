import { errorResponseSchema, type ApiOperation } from "@trading/contracts";
import { ApiError, type CallInput, type TradingClient } from "./trading-client";

/** Client-side HTTP policy (ADR-011 point 15). */
export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_RETRIES = 2;
export const BACKOFF_BASE_MS = 250;
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

export interface HttpTradingClientOptions {
  /** Origin of the API, without a path: the operations carry `/api/v1/...`. */
  readonly baseUrl: string;
  /** The access token lives in memory only (ADR-005 point 4); the session owns it. */
  readonly getAccessToken?: () => string | undefined;
  readonly fetch?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
}

interface RawResponse {
  readonly status: number;
  readonly text: string;
}

function buildUrl(baseUrl: string, operation: ApiOperation, input: CallInput): string {
  const path = operation.path.replace(/:(\w+)/g, (_match, name: string) => {
    const value = input.params?.[name];
    if (value === undefined) {
      throw new Error(`Missing path parameter "${name}" for ${operation.operationId}`);
    }
    return encodeURIComponent(value);
  });
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  }
  const search = query.size > 0 ? `?${query.toString()}` : "";
  return `${baseUrl.replace(/\/+$/, "")}${path}${search}`;
}

/** A read is retried; a write only when it carries an Idempotency-Key. */
function isSafeToRetry(operation: ApiOperation, input: CallInput): boolean {
  return operation.method === "get" || input.idempotencyKey !== undefined;
}

/** The refresh cookie is read (refresh, logout) or set (login): the browser must send and store it. */
function usesSessionCookie(operation: ApiOperation): boolean {
  return operation.cookies !== undefined || "Set-Cookie" in (operation.success.headers ?? {});
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toResult(operation: ApiOperation, raw: RawResponse): unknown {
  if (raw.status >= 200 && raw.status < 300) {
    const schema = operation.success.schema;
    if (!schema) {
      return undefined;
    }
    const parsed = schema.safeParse(parseJson(raw.text));
    if (!parsed.success) {
      throw new ApiError(
        "INVALID_RESPONSE",
        "The response does not match its contract",
        raw.status,
      );
    }
    return parsed.data;
  }
  const envelope = errorResponseSchema.safeParse(parseJson(raw.text));
  if (!envelope.success) {
    throw new ApiError(
      "INVALID_RESPONSE",
      `Unexpected response (HTTP ${String(raw.status)})`,
      raw.status,
    );
  }
  const { code, message, requestId, details } = envelope.data.error;
  throw new ApiError(code, message, raw.status, requestId, details);
}

export function createHttpTradingClient(options: HttpTradingClientOptions): TradingClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function send(
    url: string,
    operation: ApiOperation,
    input: CallInput,
  ): Promise<RawResponse> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (input.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const token = operation.authenticated ? options.getAccessToken?.() : undefined;
    if (token !== undefined) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (input.idempotencyKey !== undefined) {
      headers["Idempotency-Key"] = input.idempotencyKey;
    }
    if (operation.cookies !== undefined) {
      // The routes that read the refresh cookie demand this header (ADR-005 point 7).
      headers["X-Requested-With"] = "XMLHttpRequest";
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
      const response = await doFetch(url, {
        method: operation.method.toUpperCase(),
        headers,
        ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
        signal: controller.signal,
        ...(usesSessionCookie(operation) ? { credentials: "include" as const } : {}),
      });
      return { status: response.status, text: await response.text() };
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError("TIMEOUT", "The request timed out");
      }
      throw new ApiError("NETWORK_ERROR", "The network request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async call(operation, input = {}) {
      const url = buildUrl(options.baseUrl, operation, input);
      const maxRetries = isSafeToRetry(operation, input) ? MAX_RETRIES : 0;

      for (let attempt = 0; ; attempt++) {
        let raw: RawResponse;
        try {
          raw = await send(url, operation, input);
        } catch (error) {
          if (attempt >= maxRetries) {
            throw error;
          }
          await sleep(BACKOFF_BASE_MS * 2 ** attempt);
          continue;
        }
        if (RETRYABLE_STATUSES.has(raw.status) && attempt < maxRetries) {
          await sleep(BACKOFF_BASE_MS * 2 ** attempt);
          continue;
        }
        return toResult(operation, raw);
      }
    },
  };
}
