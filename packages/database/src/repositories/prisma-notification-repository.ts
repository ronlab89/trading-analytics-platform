import type {
  CreateNotificationInput,
  Notification,
  NotificationRepository,
} from "@trading/domain";
import type { Prisma } from "../../generated/client/index.js";
import { prisma } from "../client.js";
import { toDomainNotification, toPrismaCreateInput } from "../mappers/notification-mapper.js";

export class PrismaNotificationRepository implements NotificationRepository {
  async listByUserId(userId: string, filter?: { unreadOnly?: boolean }): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(filter?.unreadOnly ? { readAt: null } : {}),
    };

    const rows = await prisma.notification.findMany({ where, orderBy: { createdAt: "desc" } });
    return rows.map(toDomainNotification);
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const row = await prisma.notification.create({ data: toPrismaCreateInput(input) });
    return toDomainNotification(row);
  }

  async markAsRead(id: string, readAt: Date): Promise<Notification> {
    const row = await prisma.notification.update({ where: { id }, data: { readAt } });
    return toDomainNotification(row);
  }

  async markAllAsRead(userId: string, readAt: Date): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt },
    });
  }
}
