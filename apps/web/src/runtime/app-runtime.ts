import type { TradingClient } from "@/api/trading-client";
import type { RealtimeClient } from "@/realtime/realtime-client";

/**
 * What the "Demo data" menu of the shell can do. Only the demo build has them, so the shell shows the
 * menu when it gets them and nothing of the demo reaches the real bundle (ADR-012 point 9).
 */
export interface DemoControls {
  /** Closes the realtime connection from the server side; the client reconnects through its real states. */
  simulateConnectionIssue(): void;
  /** Creates a notification and publishes it, so it shows in the bell. */
  sendTestNotification(): void | Promise<void>;
  /** Brings the demo back to its seed. */
  reset(): void | Promise<void>;
}

/** The adapters the UI is plugged into: the API in real mode, the in-process demo otherwise. */
export interface AppRuntime {
  readonly tradingClient: TradingClient;
  readonly realtimeClient: RealtimeClient;
  /** Present in the demo build only. */
  readonly demoControls?: DemoControls;
}
