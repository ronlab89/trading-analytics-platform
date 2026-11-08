import { validateNewNotification } from "@trading/domain";
import { PrismaNotificationRepository } from "../../repositories/prisma-notification-repository.js";
import { SEED_NOTIFICATIONS } from "../data/notifications.js";
import type { SeedContext } from "../context.js";

const notificationRepository = new PrismaNotificationRepository();

/**
 * Seeds notifications with a mix of severities and read/unread state.
 * Source: 05-data-model.md §21, 12-demo-mode-spec.md §13.
 */
export async function seedNotifications(context: SeedContext): Promise<SeedContext> {
  console.log("[seed] seeding notifications...");

  if (context.userId === undefined) {
    throw new Error("[seed] cannot seed notifications before a user has been seeded.");
  }
  const userId = context.userId;

  for (const blueprint of SEED_NOTIFICATIONS) {
    const input = {
      userId,
      type: blueprint.type,
      title: blueprint.title,
      message: blueprint.message,
      severity: blueprint.severity,
    };

    validateNewNotification(input);
    const notification = await notificationRepository.create(input);

    if (blueprint.read) {
      await notificationRepository.markAsRead(notification.id, new Date());
    }
  }

  return context;
}
