import type {
  CreateNotificationInput,
  Notification,
  NotificationRepository,
} from "@trading/domain";
import type { Prisma } from "../../generated/client/index.js";
import { prisma, type DatabaseClient } from "../client.js";
import { toDomainNotification, toPrismaCreateInput } from "../mappers/notification-mapper.js";

/**
 * Prisma-backed implementation of `NotificationRepository`.
 *
 * Accepts an optional client so it can join a Unit of Work
 * (see prisma-unit-of-work.ts); defaults to the shared client.
 */
export class PrismaNotificationRepository implements NotificationRepository {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient = prisma) {
    this.db = db;
  }

  async listByUserId(userId: string, filter?: { unreadOnly?: boolean }): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(filter?.unreadOnly ? { readAt: null } : {}),
    };

    const rows = await this.db.notification.findMany({ where, orderBy: { createdAt: "desc" } });
    return rows.map(toDomainNotification);
  }

  async getById(id: string): Promise<Notification | null> {
    const row = await this.db.notification.findUnique({ where: { id } });
    return row ? toDomainNotification(row) : null;
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const row = await this.db.notification.create({ data: toPrismaCreateInput(input) });
    return toDomainNotification(row);
  }

  async markAsRead(id: string, readAt: Date): Promise<Notification> {
    const row = await this.db.notification.update({ where: { id }, data: { readAt } });
    return toDomainNotification(row);
  }

  async markAllAsRead(userId: string, readAt: Date): Promise<void> {
    await this.db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt },
    });
  }
}
