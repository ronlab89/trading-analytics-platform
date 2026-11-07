import type { DemoControls } from "@/runtime/app-runtime";
import type { DemoRealtimeServer } from "./demo-realtime-server";

export interface DemoControlsDependencies {
  readonly realtimeServer: Pick<DemoRealtimeServer, "dropConnections">;
}

/**
 * The actions of the "Demo data" menu. Each one is armed by the user, never random (ADR-012
 * point 6). The actions not wired yet do nothing; FE4.4 wires them one by one.
 */
export function createDemoControls({ realtimeServer }: DemoControlsDependencies): DemoControls {
  return {
    // The server closes every connection the way a lost one would, and the real client goes through
    // `reconnecting` and back to `connected` by itself, so the status bar and the stale-data alert show it.
    simulateConnectionIssue: () => {
      realtimeServer.dropConnections();
    },
    sendTestNotification: () => undefined,
    reset: () => undefined,
  };
}
