import { createHttpTradingClient } from "@/api/http-trading-client";
import { env } from "@/config/env";
import { logger } from "@/lib/logging/logger";
import { createWebSocketRealtimeClient } from "@/realtime/websocket-realtime-client";
import { getAccessToken, watchAccessToken } from "@/stores/session-store";
import type { AppRuntime } from "./app-runtime";

/** Marker the bundle check looks for: the real bundle has it, the demo bundle must not. */
export const HTTP_ADAPTER_MARKER = "adapter:http";

export function createHttpRuntime(): AppRuntime {
  logger.info(HTTP_ADAPTER_MARKER);
  return {
    tradingClient: createHttpTradingClient({ baseUrl: env.VITE_API_BASE_URL, getAccessToken }),
    realtimeClient: createWebSocketRealtimeClient({
      url: env.VITE_WS_URL,
      getAccessToken,
      watchAccessToken,
      logger,
    }),
  };
}
