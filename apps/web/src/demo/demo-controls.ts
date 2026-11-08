import type { RealtimePublisher } from "@trading/application";
import { NotificationSeverity } from "@trading/domain";
import type { NotificationRepository } from "@trading/domain";
import type { DemoControls } from "@/runtime/app-runtime";
import type { DemoRealtimeServer } from "./demo-realtime-server";

export interface DemoControlsDependencies {
  readonly realtimeServer: Pick<DemoRealtimeServer, "dropConnections">;
  readonly notificationRepository: Pick<NotificationRepository, "create">;
  readonly realtimePublisher: Pick<RealtimePublisher, "notificationCreated">;
  readonly userId: string;
  /** Loads the page again, which brings the in-memory demo back to its seed. */
  readonly reload: () => void;
}

/**
 * The actions of the "Demo data" menu. Each one is armed by the user, never random (ADR-012
 * point 6).
 */
export function createDemoControls({
  realtimeServer,
  notificationRepository,
  realtimePublisher,
  userId,
  reload,
}: DemoControlsDependencies): DemoControls {
  return {
    // The server closes every connection the way a lost one would, and the real client goes through
    // `reconnecting` and back to `connected` by itself, so the status bar and the stale-data alert show it.
    simulateConnectionIssue: () => {
      realtimeServer.dropConnections();
    },
    // Stored and published like any notification, so the bell badge and the panel update live.
    sendTestNotification: async () => {
      const notification = await notificationRepository.create({
        userId,
        type: "TEST_NOTIFICATION",
        title: "Test notification",
        message: "This one was sent from the demo menu.",
        severity: NotificationSeverity.INFO,
      });
      await realtimePublisher.notificationCreated(notification);
    },
    // Everything the demo holds is in memory, so loading the page again is the reset.
    reset: () => {
      reload();
    },
  };
}
