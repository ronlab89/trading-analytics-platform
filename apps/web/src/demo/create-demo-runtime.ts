import type { AppRuntime } from "@/runtime/app-runtime";
import { createDemoTradingClient } from "./create-demo-trading-client";
import { createDemoComposition } from "./demo-composition";
import { createInertRealtimeClient } from "./inert-realtime-client";

export async function createDemoRuntime(): Promise<AppRuntime> {
  const composition = await createDemoComposition();
  return {
    tradingClient: createDemoTradingClient({ composition }),
    realtimeClient: createInertRealtimeClient(),
  };
}
