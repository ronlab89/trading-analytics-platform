import type { AppRuntime } from "@/runtime/app-runtime";
import { createDemoTradingClient } from "./create-demo-trading-client";
import { createDemoComposition } from "./demo-composition";
import { createInertRealtimeClient } from "./inert-realtime-client";
import { createLatency, NO_LATENCY } from "./latency";

/** `VITE_DEMO_LATENCY=off` removes the simulated wait; the unit and smoke tests use it (ADR-012 point 5). */
const latencyOff = import.meta.env.VITE_DEMO_LATENCY === "off";

export async function createDemoRuntime(): Promise<AppRuntime> {
  const composition = await createDemoComposition();
  composition.jobRunner.start();
  return {
    tradingClient: createDemoTradingClient({
      composition,
      latency: latencyOff ? NO_LATENCY : createLatency(),
    }),
    realtimeClient: createInertRealtimeClient(),
  };
}
