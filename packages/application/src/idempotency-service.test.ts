import { describe, expect, it, vi } from "vitest";
import { InvalidIdempotencyKeyError } from "@trading/domain";
import type {
  IdempotencyRecord,
  ReserveIdempotencyKeyInput,
  ReserveIdempotencyKeyResult,
} from "@trading/domain";
import { fixedClock } from "./clock.js";
import { ConflictError } from "./errors.js";
import {
  IDEMPOTENCY_LEASE_MS,
  IDEMPOTENCY_TTL_MS,
  createIdempotencyService,
} from "./idempotency-service.js";

const NOW = new Date("2026-03-01T12:00:00Z");

function record(overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord {
  return {
    id: "k1",
    userId: "u1",
    key: "abc",
    requestHash: "hash-1",
    status: "COMPLETED",
    responseStatus: 201,
    responseBody: { data: { id: "t1" } },
    leaseExpiresAt: NOW,
    expiresAt: NOW,
    createdAt: NOW,
    ...overrides,
  };
}

function build(result: ReserveIdempotencyKeyResult) {
  const reserve = vi.fn((_input: ReserveIdempotencyKeyInput, _now: Date) =>
    Promise.resolve(result),
  );
  const complete = vi.fn(() => Promise.resolve(true));
  const release = vi.fn(() => Promise.resolve());
  const purgeExpired = vi.fn(() => Promise.resolve(3));
  const service = createIdempotencyService({
    idempotencyKeyRepository: { reserve, complete, release, purgeExpired },
    clock: fixedClock(NOW),
  });
  return { service, reserve, complete, release, purgeExpired };
}

const request = { userId: "u1", key: "abc", requestHash: "hash-1" };

describe("idempotency service: begin", () => {
  it("lets the request proceed when it wins the reservation, with a 60-second lease and 24-hour expiry", async () => {
    const { service, reserve } = build({ outcome: "reserved", record: record() });

    await expect(service.begin(request)).resolves.toEqual({ kind: "proceed" });

    expect(reserve).toHaveBeenCalledWith(
      {
        userId: "u1",
        key: "abc",
        requestHash: "hash-1",
        leaseExpiresAt: new Date(NOW.getTime() + IDEMPOTENCY_LEASE_MS),
        expiresAt: new Date(NOW.getTime() + IDEMPOTENCY_TTL_MS),
      },
      NOW,
    );
    expect(IDEMPOTENCY_LEASE_MS).toBe(60_000);
    expect(IDEMPOTENCY_TTL_MS).toBe(86_400_000);
  });

  it("answers a repeat of a completed request with the stored response", async () => {
    const { service } = build({ outcome: "replay", record: record() });

    await expect(service.begin(request)).resolves.toEqual({
      kind: "replay",
      status: 201,
      body: { data: { id: "t1" } },
    });
  });

  it("refuses the same key with a different request as a conflict", async () => {
    const { service } = build({ outcome: "mismatch", record: record() });

    const error = await service.begin(request).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe(
      "This Idempotency-Key was already used for a different request.",
    );
  });

  it("refuses a second request while the first is in flight as a conflict", async () => {
    const { service } = build({ outcome: "in_flight", record: record({ status: "RESERVED" }) });

    const error = await service.begin(request).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe(
      "A request with this Idempotency-Key is still being processed.",
    );
  });

  it("rejects a key the domain does not accept, without touching the repository", async () => {
    const { service, reserve } = build({ outcome: "reserved", record: record() });

    await expect(service.begin({ ...request, key: "x".repeat(256) })).rejects.toBeInstanceOf(
      InvalidIdempotencyKeyError,
    );
    await expect(service.begin({ ...request, key: " " })).rejects.toBeInstanceOf(
      InvalidIdempotencyKeyError,
    );
    expect(reserve).not.toHaveBeenCalled();
  });
});

describe("idempotency service: storing and releasing", () => {
  const response = { userId: "u1", key: "abc", responseStatus: 201, responseBody: { ok: true } };

  it("stores the response through the repository of the unit of work it is given", async () => {
    const { service, complete } = build({ outcome: "reserved", record: record() });
    const inUnit = { complete: vi.fn(() => Promise.resolve(true)) };

    await expect(service.complete(response, inUnit)).resolves.toBe(true);

    expect(inUnit.complete).toHaveBeenCalledWith(response);
    expect(complete).not.toHaveBeenCalled();
  });

  it("stores the response through its own repository when no unit is given", async () => {
    const { service, complete } = build({ outcome: "reserved", record: record() });

    await service.complete(response);

    expect(complete).toHaveBeenCalledWith(response);
  });

  it("releases a reservation", async () => {
    const { service, release } = build({ outcome: "reserved", record: record() });

    await service.release("u1", "abc");

    expect(release).toHaveBeenCalledWith("u1", "abc");
  });

  it("purges the records past their expiry as of now", async () => {
    const { service, purgeExpired } = build({ outcome: "reserved", record: record() });

    await expect(service.purgeExpired()).resolves.toBe(3);
    expect(purgeExpired).toHaveBeenCalledWith(NOW);
  });
});
