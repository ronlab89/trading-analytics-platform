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
}

/**
 * The actions of the "Demo data" menu. Each one is armed by the user, never random (ADR-012
 * point 6). The actions not wired yet do nothing; FE4.4 wires them one by one.
 */
export function createDemoControls({
  realtimeServer,
  notificationRepository,
  realtimePublisher,
  userId,
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
    reset: () => undefined,
  };
}
