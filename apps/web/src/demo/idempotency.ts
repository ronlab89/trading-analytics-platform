import type { IdempotencyService } from "@trading/application";

/** Same key order and shape for the same request, whatever the order the fields came in. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export interface IdempotentCall {
  readonly userId: string;
  readonly key: string;
  readonly operationId: string;
  readonly successStatus: number;
  readonly params: unknown;
  readonly body: unknown;
}

/**
 * The same `Idempotency-Key` flow as the API middleware (ADR-008 point 8): the same key with the same
 * request replays the stored answer, with another request it is a conflict, and a failed call frees the
 * key so the retry can run. The request is compared as text because the browser has no `node:crypto`.
 */
export async function runIdempotent(
  service: Pick<IdempotencyService, "begin" | "complete" | "release">,
  call: IdempotentCall,
  run: () => Promise<unknown>,
): Promise<unknown> {
  const { userId, key } = call;
  const decision = await service.begin({
    userId,
    key,
    requestHash: canonicalJson([call.operationId, call.params, call.body]),
  });
  if (decision.kind === "replay") return decision.body;

  try {
    const result = await run();
    await service.complete({
      userId,
      key,
      responseStatus: call.successStatus,
      responseBody: result,
    });
    return result;
  } catch (error) {
    await service.release(userId, key);
    throw error;
  }
}
