import type { Notification as PrismaNotification, Prisma } from "../../generated/client/index.js";
import type { CreateNotificationInput, Notification, NotificationSeverity } from "@trading/domain";

function toDomainSeverity(severity: PrismaNotification["severity"]): NotificationSeverity {
  return severity;
}

/**
 * `metadata` is `Json?` (nullable) in the schema, but the domain entity
 * requires `Readonly<Record<string, unknown>>` (non-nullable) — a
 * deliberate mismatch resolved entirely at this boundary (confirmed
 * decision, no migration): nullable is a superset of non-nullable, so
 * `null` on read is coalesced to `{}`, and writes never persist `null`.
 */
function toDomainMetadata(
  metadata: PrismaNotification["metadata"],
): Readonly<Record<string, unknown>> {
  return (metadata ?? {}) as Readonly<Record<string, unknown>>;
}

export function toDomainNotification(row: PrismaNotification): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    severity: toDomainSeverity(row.severity),
    readAt: row.readAt,
    createdAt: row.createdAt,
    metadata: toDomainMetadata(row.metadata),
  };
}

export function toPrismaCreateInput(input: CreateNotificationInput) {
  return {
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    severity: input.severity,
    ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
  };
}
