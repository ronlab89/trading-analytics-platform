import type { Response } from "supertest";

/**
 * Response envelope shapes used across API tests. These are deliberately
 * loose (not the exact domain types) — they exist to give test
 * assertions a typed `.body` without repeating an inline `as {...}`
 * cast in every test file (see app.test.ts, which did this once before
 * this helper existed).
 */
export interface DataEnvelope<T> {
  data: T;
}

export interface DataMetaEnvelope<T, M = Record<string, unknown>> {
  data: T;
  meta: M;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: { field?: string; code?: string; message: string }[];
  };
}

/**
 * Casts a supertest response body to the given envelope shape.
 *
 * `T` intentionally appears only in the return position: this helper
 * exists purely to let call sites name the expected shape explicitly
 * (`body<DataEnvelope<Foo>>(response)`) instead of repeating an inline
 * `as {...}` cast in every test, which is what triggered this same
 * lint rule inline in app.test.ts before this helper existed.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- see comment above
export function body<T>(response: Response): T {
  return response.body as T;
}
