import { logger } from "@/lib/logging/logger";
import { createWebSocketRealtimeClient } from "@/realtime/websocket-realtime-client";
import type { AppRuntime } from "@/runtime/app-runtime";
import { getAccessToken, watchAccessToken } from "@/stores/session-store";
import { createDemoTradingClient } from "./create-demo-trading-client";
import { createDemoComposition } from "./demo-composition";
import { createDemoRealtimeServer } from "./demo-realtime-server";
import { createLatency, NO_LATENCY } from "./latency";

/** `VITE_DEMO_LATENCY=off` removes the simulated wait; the unit and smoke tests use it (ADR-012 point 5). */
const latencyOff = import.meta.env.VITE_DEMO_LATENCY === "off";

export async function createDemoRuntime(): Promise<AppRuntime> {
  const composition = await createDemoComposition();
  composition.jobRunner.start();
  const realtimeServer = createDemoRealtimeServer({ clock: { now: () => new Date() } });
  return {
    tradingClient: createDemoTradingClient({
      composition,
      latency: latencyOff ? NO_LATENCY : createLatency(),
    }),
    // The real WebSocket client over an in-process socket: same states, reconnection and resync.
    realtimeClient: createWebSocketRealtimeClient({
      url: "demo://realtime",
      getAccessToken,
      watchAccessToken,
      createSocket: realtimeServer.createSocket,
      logger,
    }),
  };
}
