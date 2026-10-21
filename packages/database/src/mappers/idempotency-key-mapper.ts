import {
  Prisma,
  type IdempotencyKey as PrismaIdempotencyKey,
} from "../../generated/client/index.js";
import type { IdempotencyRecord, ReserveIdempotencyKeyInput } from "@trading/domain";

export function toDomainIdempotencyRecord(row: PrismaIdempotencyKey): IdempotencyRecord {
  return {
    id: row.id,
    userId: row.userId,
    key: row.key,
    requestHash: row.requestHash,
    status: row.status,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
    leaseExpiresAt: row.leaseExpiresAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export function toPrismaReservation(
  input: ReserveIdempotencyKeyInput,
): Prisma.IdempotencyKeyUncheckedCreateInput {
  return {
    userId: input.userId,
    key: input.key,
    requestHash: input.requestHash,
    leaseExpiresAt: input.leaseExpiresAt,
    expiresAt: input.expiresAt,
  };
}

/** A stored response of `null` is a JSON null the replay must give back, not an absent one. */
export function toPrismaResponseBody(
  body: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return body === null ? Prisma.JsonNull : (body as Prisma.InputJsonValue);
}
