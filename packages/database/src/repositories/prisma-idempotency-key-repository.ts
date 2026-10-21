import type {
  CompleteIdempotencyKeyInput,
  IdempotencyKeyRepository,
  IdempotencyRecord,
  ReserveIdempotencyKeyInput,
  ReserveIdempotencyKeyResult,
} from "@trading/domain";
import { Prisma } from "../../generated/client/index.js";
import { prisma, type DatabaseClient } from "../client.js";
import {
  toDomainIdempotencyRecord,
  toPrismaReservation,
  toPrismaResponseBody,
} from "../mappers/idempotency-key-mapper.js";

/** A taken-over or vanished row is retried; this bounds the loop. */
const MAX_RESERVE_ATTEMPTS = 3;

/**
 * Prisma-backed implementation of `IdempotencyKeyRepository`.
 *
 * `reserve` relies on the unique `(userId, key)` constraint: of two requests
 * that insert at the same moment, one hits P2002 and reads what the other
 * wrote. A failed insert aborts a Postgres transaction, so `reserve` must run
 * on the shared client, never inside a Unit of Work; `complete` is the call
 * that joins one (see prisma-unit-of-work.ts).
 */
export class PrismaIdempotencyKeyRepository implements IdempotencyKeyRepository {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient = prisma) {
    this.db = db;
  }

  async reserve(
    input: ReserveIdempotencyKeyInput,
    now: Date,
  ): Promise<ReserveIdempotencyKeyResult> {
    for (let attempt = 0; attempt < MAX_RESERVE_ATTEMPTS; attempt += 1) {
      const inserted = await this.tryInsert(input);
      if (inserted) {
        return { outcome: "reserved", record: inserted };
      }

      const existing = await this.db.idempotencyKey.findUnique({
        where: { userId_key: { userId: input.userId, key: input.key } },
      });
      if (!existing) {
        continue;
      }

      const record = toDomainIdempotencyRecord(existing);
      if (!isAbsent(record, now)) {
        return classify(record, input.requestHash);
      }

      const taken = await this.tryTakeOver(record, input);
      if (taken) {
        return { outcome: "reserved", record: taken };
      }
    }

    throw new Error("The idempotency key kept changing while it was being reserved.");
  }

  async complete(input: CompleteIdempotencyKeyInput): Promise<boolean> {
    const result = await this.db.idempotencyKey.updateMany({
      where: { userId: input.userId, key: input.key, status: "RESERVED" },
      data: {
        status: "COMPLETED",
        responseStatus: input.responseStatus,
        responseBody: toPrismaResponseBody(input.responseBody),
      },
    });
    return result.count === 1;
  }

  async release(userId: string, key: string): Promise<void> {
    await this.db.idempotencyKey.deleteMany({ where: { userId, key, status: "RESERVED" } });
  }

  async purgeExpired(now: Date): Promise<number> {
    const result = await this.db.idempotencyKey.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return result.count;
  }

  private async tryInsert(input: ReserveIdempotencyKeyInput): Promise<IdempotencyRecord | null> {
    try {
      const row = await this.db.idempotencyKey.create({ data: toPrismaReservation(input) });
      return toDomainIdempotencyRecord(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    }
  }

  /**
   * Replaces an absent record in place. The `where` repeats what was read, so
   * of two requests taking over the same stale row only one matches.
   */
  private async tryTakeOver(
    stale: IdempotencyRecord,
    input: ReserveIdempotencyKeyInput,
  ): Promise<IdempotencyRecord | null> {
    try {
      const row = await this.db.idempotencyKey.update({
        where: {
          id: stale.id,
          status: stale.status,
          requestHash: stale.requestHash,
          leaseExpiresAt: stale.leaseExpiresAt,
          expiresAt: stale.expiresAt,
        },
        data: {
          requestHash: input.requestHash,
          status: "RESERVED",
          responseStatus: null,
          responseBody: Prisma.DbNull,
          leaseExpiresAt: input.leaseExpiresAt,
          expiresAt: input.expiresAt,
          createdAt: new Date(),
        },
      });
      return toDomainIdempotencyRecord(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }
      throw error;
    }
  }
}

function isAbsent(record: IdempotencyRecord, now: Date): boolean {
  return (
    record.expiresAt.getTime() <= now.getTime() ||
    (record.status === "RESERVED" && record.leaseExpiresAt.getTime() <= now.getTime())
  );
}

function classify(record: IdempotencyRecord, requestHash: string): ReserveIdempotencyKeyResult {
  if (record.requestHash !== requestHash) {
    return { outcome: "mismatch", record };
  }

  return { outcome: record.status === "COMPLETED" ? "replay" : "in_flight", record };
}
