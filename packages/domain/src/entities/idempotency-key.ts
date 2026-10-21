/**
 * Idempotency record: the stored outcome of one request carrying an
 * `Idempotency-Key`, per user.
 * Source: ADR-008 point 8 and Deferred detail, docs/07-api-spec.md §39.
 *
 * A key is first `RESERVED` (so a second in-flight request is refused), then
 * `COMPLETED` with the response, written in the same unit of work as the
 * mutation it protects. A reservation has a lease: once `leaseExpiresAt`
 * passes, a crashed request no longer blocks the key. The record itself stops
 * counting at `expiresAt` (24 hours). `requestHash` covers method, route, path
 * parameters and body, computed by the caller.
 *
 * Pure domain type: no hashing algorithm, no clock and no I/O.
 */
export const IdempotencyStatus = {
  RESERVED: "RESERVED",
  COMPLETED: "COMPLETED",
} as const;

export type IdempotencyStatus = (typeof IdempotencyStatus)[keyof typeof IdempotencyStatus];

export interface IdempotencyRecord {
  readonly id: string;
  readonly userId: string;
  readonly key: string;
  readonly requestHash: string;
  readonly status: IdempotencyStatus;
  readonly responseStatus: number | null;
  readonly responseBody: unknown;
  readonly leaseExpiresAt: Date;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export type ReserveIdempotencyKeyInput = Pick<
  IdempotencyRecord,
  "userId" | "key" | "requestHash" | "leaseExpiresAt" | "expiresAt"
>;

/**
 * What a reservation found: `reserved` (the caller owns the key and must go
 * on), `replay` (a completed record with the same request), `in_flight`
 * (another request holds a live reservation) or `mismatch` (the key was used
 * for a different request).
 */
export type ReserveIdempotencyKeyResult =
  | { readonly outcome: "reserved"; readonly record: IdempotencyRecord }
  | { readonly outcome: "replay"; readonly record: IdempotencyRecord }
  | { readonly outcome: "in_flight"; readonly record: IdempotencyRecord }
  | { readonly outcome: "mismatch"; readonly record: IdempotencyRecord };

export interface CompleteIdempotencyKeyInput {
  readonly userId: string;
  readonly key: string;
  readonly responseStatus: number;
  readonly responseBody: unknown;
}

export class InvalidIdempotencyKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidIdempotencyKeyError";
  }
}

export const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

/** Domain invariants for a reservation. */
export function validateIdempotencyReservation(input: ReserveIdempotencyKeyInput): void {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new InvalidIdempotencyKeyError("A userId is required.");
  }

  if (!input.key || input.key.trim().length === 0) {
    throw new InvalidIdempotencyKeyError("An idempotency key is required.");
  }

  if (input.key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new InvalidIdempotencyKeyError(
      `The idempotency key is limited to ${String(IDEMPOTENCY_KEY_MAX_LENGTH)} characters.`,
    );
  }

  if (!input.requestHash || input.requestHash.trim().length === 0) {
    throw new InvalidIdempotencyKeyError("A request hash is required.");
  }

  if (Number.isNaN(input.leaseExpiresAt.getTime()) || Number.isNaN(input.expiresAt.getTime())) {
    throw new InvalidIdempotencyKeyError("leaseExpiresAt and expiresAt must be valid dates.");
  }
}
