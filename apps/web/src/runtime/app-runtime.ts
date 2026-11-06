import type { TradingClient } from "@/api/trading-client";
import type { RealtimeClient } from "@/realtime/realtime-client";

/** The two adapters the UI is plugged into: the API in real mode, the in-process demo otherwise. */
export interface AppRuntime {
  readonly tradingClient: TradingClient;
  readonly realtimeClient: RealtimeClient;
}
