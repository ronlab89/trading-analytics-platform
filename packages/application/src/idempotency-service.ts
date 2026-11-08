import { validateIdempotencyReservation } from "@trading/domain";
import type {
  CompleteIdempotencyKeyInput,
  IdempotencyKeyRepository,
  ReserveIdempotencyKeyInput,
} from "@trading/domain";
import type { Clock } from "./clock.js";
import { ConflictError } from "./errors.js";

/** How long a reservation blocks the key before a crashed request stops mattering (ADR-008 Deferred detail). */
export const IDEMPOTENCY_LEASE_MS = 60 * 1000;

/** How long a stored response answers a repeated key (ADR-008 point 8). */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export interface IdempotencyServiceDependencies {
  idempotencyKeyRepository: Pick<
    IdempotencyKeyRepository,
    "reserve" | "complete" | "release" | "purgeExpired"
  >;
  clock: Clock;
  leaseMs?: number;
  ttlMs?: number;
}

/** What `begin` decided: run the request, or answer it with what was stored. */
export type IdempotencyDecision =
  | { readonly kind: "proceed" }
  | { readonly kind: "replay"; readonly status: number; readonly body: unknown };

export interface BeginIdempotentRequest {
  readonly userId: string;
  readonly key: string;
  /** Covers method, route, path parameters and body (ADR-008 Deferred detail); computed by the caller. */
  readonly requestHash: string;
}

/**
 * `Idempotency-Key` use cases.
 * Source: ADR-008 point 8 and Deferred detail, docs/07-api-spec.md §39.
 *
 * `begin` reserves the key before the request runs. The request that wins the
 * reservation proceeds; a repeat of a completed request is answered with the
 * stored response; the same key with a different request, or while the first
 * request is still running, is a `ConflictError` (409). The mutation stores its
 * response with `complete`, called with the repository of its own unit of work,
 * so the key and the change commit together. `release` frees a reservation
 * whose request produced a 5xx, which is never stored.
 */
export function createIdempotencyService(dependencies: IdempotencyServiceDependencies) {
  const {
    idempotencyKeyRepository,
    clock,
    leaseMs = IDEMPOTENCY_LEASE_MS,
    ttlMs = IDEMPOTENCY_TTL_MS,
  } = dependencies;

  async function begin(request: BeginIdempotentRequest): Promise<IdempotencyDecision> {
    const now = clock.now();
    const reservation: ReserveIdempotencyKeyInput = {
      userId: request.userId,
      key: request.key,
      requestHash: request.requestHash,
      leaseExpiresAt: new Date(now.getTime() + leaseMs),
      expiresAt: new Date(now.getTime() + ttlMs),
    };

    validateIdempotencyReservation(reservation);

    const result = await idempotencyKeyRepository.reserve(reservation, now);

    switch (result.outcome) {
      case "reserved":
        return { kind: "proceed" };
      case "replay":
        return {
          kind: "replay",
          status: result.record.responseStatus ?? 200,
          body: result.record.responseBody,
        };
      case "in_flight":
        throw new ConflictError("A request with this Idempotency-Key is still being processed.");
      case "mismatch":
        throw new ConflictError("This Idempotency-Key was already used for a different request.");
    }
  }

  /**
   * Stores the response. Inside a unit of work, pass that unit's repository so
   * the key commits with the mutation; resolves false when the key is not a
   * live reservation (it was already completed, which is not an error).
   */
  function complete(
    input: CompleteIdempotencyKeyInput,
    repository: Pick<IdempotencyKeyRepository, "complete"> = idempotencyKeyRepository,
  ): Promise<boolean> {
    return repository.complete(input);
  }

  function release(userId: string, key: string): Promise<void> {
    return idempotencyKeyRepository.release(userId, key);
  }

  /** Deletes the records past their 24 hours; returns how many went. */
  function purgeExpired(): Promise<number> {
    return idempotencyKeyRepository.purgeExpired(clock.now());
  }

  return { begin, complete, release, purgeExpired };
}

export type IdempotencyService = ReturnType<typeof createIdempotencyService>;
