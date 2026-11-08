import type {
  CompleteIdempotencyKeyInput,
  ReserveIdempotencyKeyInput,
  ReserveIdempotencyKeyResult,
} from "../entities/idempotency-key.js";

/**
 * Idempotency key repository contract.
 * Source: ADR-008 point 8 and Deferred detail, docs/07-api-spec.md §39.
 *
 * `(userId, key)` is unique, so of two requests that reserve at the same
 * moment only one gets `reserved`. A record whose lease (while `RESERVED`) or
 * whose `expiresAt` has passed counts as absent and is taken over. Time
 * always comes from the caller.
 */
export interface IdempotencyKeyRepository {
  /**
   * Reserves the key for a request, or reports what already holds it:
   * `replay` for a completed record with the same hash, `mismatch` for a
   * different hash, `in_flight` for a live reservation. Callers are expected
   * to have run `validateIdempotencyReservation`.
   */
  reserve(input: ReserveIdempotencyKeyInput, now: Date): Promise<ReserveIdempotencyKeyResult>;

  /**
   * Stores the response and marks the record `COMPLETED`. Meant to run inside
   * the unit of work of the mutation it protects. Resolves false, changing
   * nothing, when the record is not a `RESERVED` one.
   */
  complete(input: CompleteIdempotencyKeyInput): Promise<boolean>;

  /** Drops a `RESERVED` record, for a request that ended in a 5xx and stores nothing. */
  release(userId: string, key: string): Promise<void>;

  /** Deletes the records past `expiresAt` and returns how many went. */
  purgeExpired(now: Date): Promise<number>;
}
