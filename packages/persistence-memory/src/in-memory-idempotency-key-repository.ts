import type {
  CompleteIdempotencyKeyInput,
  IdempotencyKeyRepository,
  IdempotencyRecord,
  ReserveIdempotencyKeyInput,
  ReserveIdempotencyKeyResult,
} from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/** Opaque copy of the repository state, for `snapshot` and `restore`. */
export interface InMemoryIdempotencyKeySnapshot {
  readonly rows: ReadonlyMap<string, IdempotencyRecord>;
  readonly sequence: number;
}

/**
 * In-memory implementation of `IdempotencyKeyRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: `(userId, key)` is unique, a record past its
 * expiry or a reservation past its lease counts as absent and is replaced,
 * and the stored response is a copy, so a later change to the caller's object
 * cannot alter what is replayed. Every method runs synchronously inside its
 * promise, so two reservations never interleave.
 */
export class InMemoryIdempotencyKeyRepository implements IdempotencyKeyRepository {
  private readonly rows = new Map<string, IdempotencyRecord>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  /** Captures the current state; used by the unit of work to roll back. */
  snapshot(): InMemoryIdempotencyKeySnapshot {
    return { rows: new Map(this.rows), sequence: this.sequence };
  }

  /** Replaces the current state with a snapshot; the snapshot stays reusable. */
  restore(snapshot: InMemoryIdempotencyKeySnapshot): void {
    this.rows.clear();
    for (const [id, row] of snapshot.rows) {
      this.rows.set(id, row);
    }
    this.sequence = snapshot.sequence;
  }

  reserve(input: ReserveIdempotencyKeyInput, now: Date): Promise<ReserveIdempotencyKeyResult> {
    const mapKey = keyOf(input.userId, input.key);
    const existing = this.rows.get(mapKey);

    if (existing && !isAbsent(existing, now)) {
      if (existing.requestHash !== input.requestHash) {
        return Promise.resolve({ outcome: "mismatch", record: existing });
      }

      return Promise.resolve({
        outcome: existing.status === "COMPLETED" ? "replay" : "in_flight",
        record: existing,
      });
    }

    const record: IdempotencyRecord = {
      id: `idempotency_${String(++this.sequence)}`,
      userId: input.userId,
      key: input.key,
      requestHash: input.requestHash,
      status: "RESERVED",
      responseStatus: null,
      responseBody: null,
      leaseExpiresAt: input.leaseExpiresAt,
      expiresAt: input.expiresAt,
      createdAt: this.now(),
    };
    this.rows.set(mapKey, record);

    return Promise.resolve({ outcome: "reserved", record });
  }

  complete(input: CompleteIdempotencyKeyInput): Promise<boolean> {
    const mapKey = keyOf(input.userId, input.key);
    const existing = this.rows.get(mapKey);

    if (existing?.status !== "RESERVED") {
      return Promise.resolve(false);
    }

    this.rows.set(mapKey, {
      ...existing,
      status: "COMPLETED",
      responseStatus: input.responseStatus,
      responseBody: structuredClone(input.responseBody),
    });

    return Promise.resolve(true);
  }

  release(userId: string, key: string): Promise<void> {
    const mapKey = keyOf(userId, key);

    if (this.rows.get(mapKey)?.status === "RESERVED") {
      this.rows.delete(mapKey);
    }

    return Promise.resolve();
  }

  purgeExpired(now: Date): Promise<number> {
    let purged = 0;

    for (const [mapKey, record] of this.rows) {
      if (record.expiresAt.getTime() <= now.getTime()) {
        this.rows.delete(mapKey);
        purged += 1;
      }
    }

    return Promise.resolve(purged);
  }
}

function keyOf(userId: string, key: string): string {
  return `${userId}\u0000${key}`;
}

function isAbsent(record: IdempotencyRecord, now: Date): boolean {
  return (
    record.expiresAt.getTime() <= now.getTime() ||
    (record.status === "RESERVED" && record.leaseExpiresAt.getTime() <= now.getTime())
  );
}
