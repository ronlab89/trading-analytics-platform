import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IdempotencyKeyRepository } from "@trading/domain";

export interface IdempotencyKeyContractContext {
  readonly repository: IdempotencyKeyRepository;
  readonly fixtures: {
    /** An existing user that owns the keys created by the suite. */
    readonly userId: string;
    /** A second existing user, to show keys are scoped per user. */
    readonly otherUserId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Behavior every `IdempotencyKeyRepository` must have, whatever the storage.
 * Source: ADR-008 point 8 and Deferred detail, docs/07-api-spec.md §39.
 *
 * The suite passes `now` explicitly, so the lease and the 24-hour expiry are
 * tested without waiting.
 */
export function idempotencyKeyRepositoryContract(
  name: string,
  factory: () => Promise<IdempotencyKeyContractContext>,
): void {
  describe(`${name} (IdempotencyKeyRepository contract)`, () => {
    let context: IdempotencyKeyContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const now = new Date("2026-10-21T10:00:00.000Z");
    const afterLease = new Date("2026-10-21T10:02:00.000Z");
    const afterExpiry = new Date("2026-10-22T10:00:01.000Z");
    const reservation = (
      overrides: { key?: string; requestHash?: string; userId?: string } = {},
    ) => ({
      userId: context.fixtures.userId,
      key: "key-1",
      requestHash: "hash-1",
      leaseExpiresAt: new Date("2026-10-21T10:01:00.000Z"),
      expiresAt: new Date("2026-10-22T10:00:00.000Z"),
      ...overrides,
    });

    it("reserves a key that was never used", async () => {
      const result = await context.repository.reserve(reservation(), now);

      expect(result.outcome).toBe("reserved");
      expect(result.record).toMatchObject({
        ...reservation(),
        status: "RESERVED",
        responseStatus: null,
        responseBody: null,
      });
      expect(result.record.id).toEqual(expect.any(String));
      expect(result.record.createdAt).toBeInstanceOf(Date);
    });

    it("tells a second in-flight request that the key is held", async () => {
      await context.repository.reserve(reservation(), now);

      const second = await context.repository.reserve(reservation(), now);

      expect(second.outcome).toBe("in_flight");
    });

    it("lets only one of two simultaneous reservations win", async () => {
      const results = await Promise.all([
        context.repository.reserve(reservation(), now),
        context.repository.reserve(reservation(), now),
      ]);

      expect(results.map((result) => result.outcome).sort()).toEqual(["in_flight", "reserved"]);
    });

    it("reports a mismatch for the same key with a different request", async () => {
      await context.repository.reserve(reservation(), now);

      const other = await context.repository.reserve(reservation({ requestHash: "hash-2" }), now);

      expect(other.outcome).toBe("mismatch");
    });

    it("replays the stored response for the same key and request", async () => {
      await context.repository.reserve(reservation(), now);
      const completed = await context.repository.complete({
        userId: context.fixtures.userId,
        key: "key-1",
        responseStatus: 201,
        responseBody: { id: "t1", nested: { ok: true } },
      });

      const replay = await context.repository.reserve(reservation(), now);

      expect(completed).toBe(true);
      expect(replay.outcome).toBe("replay");
      expect(replay.record).toMatchObject({
        status: "COMPLETED",
        responseStatus: 201,
        responseBody: { id: "t1", nested: { ok: true } },
      });
    });

    it("reports a mismatch, not a replay, when a completed key meets another request", async () => {
      await context.repository.reserve(reservation(), now);
      await context.repository.complete({
        userId: context.fixtures.userId,
        key: "key-1",
        responseStatus: 201,
        responseBody: {},
      });

      const other = await context.repository.reserve(reservation({ requestHash: "hash-2" }), now);

      expect(other.outcome).toBe("mismatch");
    });

    it("scopes keys per user", async () => {
      await context.repository.reserve(reservation(), now);

      const other = await context.repository.reserve(
        reservation({ userId: context.fixtures.otherUserId }),
        now,
      );

      expect(other.outcome).toBe("reserved");
    });

    it("takes over a reservation whose lease ended", async () => {
      await context.repository.reserve(reservation(), now);

      const taken = await context.repository.reserve(
        {
          ...reservation({ requestHash: "hash-2" }),
          leaseExpiresAt: new Date("2026-10-21T10:03:00.000Z"),
        },
        afterLease,
      );

      expect(taken.outcome).toBe("reserved");
      expect(taken.record.requestHash).toBe("hash-2");
    });

    it("treats a record past its expiry as absent", async () => {
      await context.repository.reserve(reservation(), now);
      await context.repository.complete({
        userId: context.fixtures.userId,
        key: "key-1",
        responseStatus: 201,
        responseBody: {},
      });

      const again = await context.repository.reserve(
        {
          ...reservation({ requestHash: "hash-2" }),
          expiresAt: new Date("2026-10-23T10:00:00.000Z"),
        },
        afterExpiry,
      );

      expect(again.outcome).toBe("reserved");
      expect(again.record).toMatchObject({ requestHash: "hash-2", status: "RESERVED" });
    });

    it("does not complete a key that was never reserved or is already completed", async () => {
      const missing = await context.repository.complete({
        userId: context.fixtures.userId,
        key: "key-1",
        responseStatus: 201,
        responseBody: {},
      });
      await context.repository.reserve(reservation(), now);
      const first = await context.repository.complete({
        userId: context.fixtures.userId,
        key: "key-1",
        responseStatus: 201,
        responseBody: { first: true },
      });
      const second = await context.repository.complete({
        userId: context.fixtures.userId,
        key: "key-1",
        responseStatus: 200,
        responseBody: { second: true },
      });

      expect([missing, first, second]).toEqual([false, true, false]);
      const replay = await context.repository.reserve(reservation(), now);
      expect(replay.record.responseBody).toEqual({ first: true });
    });

    it("frees a reserved key on release but keeps a completed one", async () => {
      await context.repository.reserve(reservation(), now);
      await context.repository.release(context.fixtures.userId, "key-1");
      const again = await context.repository.reserve(reservation(), now);

      await context.repository.complete({
        userId: context.fixtures.userId,
        key: "key-1",
        responseStatus: 201,
        responseBody: {},
      });
      await context.repository.release(context.fixtures.userId, "key-1");
      const replay = await context.repository.reserve(reservation(), now);

      expect(again.outcome).toBe("reserved");
      expect(replay.outcome).toBe("replay");
    });

    it("purges the records past their expiry and reports how many", async () => {
      await context.repository.reserve(reservation({ key: "old" }), now);
      await context.repository.reserve(
        {
          ...reservation({ key: "fresh" }),
          leaseExpiresAt: new Date("2026-10-23T09:59:00.000Z"),
          expiresAt: new Date("2026-10-23T10:00:00.000Z"),
        },
        now,
      );

      const purged = await context.repository.purgeExpired(afterExpiry);

      expect(purged).toBe(1);
      const old = await context.repository.reserve(reservation({ key: "old" }), afterExpiry);
      const fresh = await context.repository.reserve(reservation({ key: "fresh" }), afterExpiry);
      expect(old.outcome).toBe("reserved");
      expect(fresh.outcome).toBe("in_flight");
    });
  });
}
