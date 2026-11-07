import { logger } from "@/lib/logging/logger";
import { createWebSocketRealtimeClient } from "@/realtime/websocket-realtime-client";
import type { AppRuntime } from "@/runtime/app-runtime";
import { getAccessToken, watchAccessToken } from "@/stores/session-store";
import { createDemoTradingClient } from "./create-demo-trading-client";
import { createDemoComposition, DEMO_USER } from "./demo-composition";
import { createDemoControls } from "./demo-controls";
import { createDemoRealtimePublisher } from "./demo-realtime-publisher";
import { createDemoRealtimeServer } from "./demo-realtime-server";
import { createLatency, NO_LATENCY } from "./latency";

/** `VITE_DEMO_LATENCY=off` removes the simulated wait; the unit and smoke tests use it (ADR-012 point 5). */
const latencyOff = import.meta.env.VITE_DEMO_LATENCY === "off";

export async function createDemoRuntime(): Promise<AppRuntime> {
  const clock = { now: () => new Date() };
  const realtimeServer = createDemoRealtimeServer({ clock });
  const realtimePublisher = createDemoRealtimePublisher(realtimeServer);
  const composition = await createDemoComposition({
    clock,
    realtimePublisher,
    marketSimulation: { logger, isVisible: () => document.visibilityState === "visible" },
  });
  composition.jobRunner.start();
  await composition.marketSimulator.start();
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
    demoControls: createDemoControls({
      realtimeServer,
      notificationRepository: composition.notificationRepository,
      realtimePublisher,
      userId: DEMO_USER.id,
    }),
  };
}
