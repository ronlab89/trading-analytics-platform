import type { Clock } from "@trading/application";
import { NotificationSeverity } from "@trading/domain";
import type { NotificationRepository } from "@trading/domain";

interface SeedNotification {
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly severity: NotificationSeverity;
  readonly read: boolean;
}

/** Created oldest first, so the last two (the unread ones) are the newest. */
const SEED_NOTIFICATIONS: readonly SeedNotification[] = [
  {
    type: "WELCOME",
    title: "Welcome to the demo",
    message: "This is sample data. Nothing you do here leaves your browser.",
    severity: NotificationSeverity.INFO,
    read: true,
  },
  {
    type: "MARKET_DATA_DELAYED",
    title: "Market data delayed",
    message: "Some prices were refreshed late during the last session.",
    severity: NotificationSeverity.WARNING,
    read: true,
  },
  {
    type: "TRANSACTION_RECORDED",
    title: "Transaction recorded",
    message: "Sold 10 SPY at 503.00 USD.",
    severity: NotificationSeverity.SUCCESS,
    read: true,
  },
  {
    type: "JOB_COMPLETED",
    title: "Import completed",
    message: "Imported 12 transactions.",
    severity: NotificationSeverity.SUCCESS,
    read: false,
  },
  {
    type: "ALERT_NEAR",
    title: "AAPL is close to your alert",
    message: "AAPL is within 5% of your 200.00 USD price alert.",
    severity: NotificationSeverity.WARNING,
    read: false,
  },
];

export interface NotificationSeedDependencies {
  readonly notificationRepository: Pick<NotificationRepository, "create" | "markAsRead">;
  readonly userId: string;
  readonly clock: Clock;
}

/** Writes straight to the repository: three read, two unread, none tied to a fired alert (FE4.3). */
export async function seedNotifications(dependencies: NotificationSeedDependencies): Promise<void> {
  const { notificationRepository, userId, clock } = dependencies;

  for (const seed of SEED_NOTIFICATIONS) {
    const notification = await notificationRepository.create({
      userId,
      type: seed.type,
      title: seed.title,
      message: seed.message,
      severity: seed.severity,
    });
    if (seed.read) await notificationRepository.markAsRead(notification.id, clock.now());
  }
}
