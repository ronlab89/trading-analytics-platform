import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router";
import { createHttpTradingClient } from "@/api/http-trading-client";
import { TradingClientProvider } from "@/api/trading-client-provider";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/config/env";
import { useRealtimeConnection } from "@/hooks/use-realtime-connection";
import { useRestoreSession } from "@/hooks/use-restore-session";
import { logger } from "@/lib/logging/logger";
import { createQueryClient } from "@/lib/query-client";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createWebSocketRealtimeClient } from "@/realtime/websocket-realtime-client";
import { router } from "@/router";
import { createAppServices } from "@/services/create-app-services";
import { SessionServiceProvider } from "@/services/session/session-provider";
import { getAccessToken, watchAccessToken } from "@/stores/session-store";

/** Inside the providers, so it can reach the session service. */
function AppRouter() {
  useRestoreSession();
  useRealtimeConnection();
  return <RouterProvider router={router} />;
}

function createServices() {
  return createAppServices(
    createHttpTradingClient({ baseUrl: env.VITE_API_BASE_URL, getAccessToken }),
  );
}

function createRealtimeClient() {
  return createWebSocketRealtimeClient({
    url: env.VITE_WS_URL,
    getAccessToken,
    watchAccessToken,
    logger,
  });
}

export function App() {
  const [queryClient] = useState(createQueryClient);
  const [services] = useState(createServices);
  const [realtimeClient] = useState(createRealtimeClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TradingClientProvider client={services.client}>
        <SessionServiceProvider service={services.session}>
          <RealtimeClientProvider client={realtimeClient}>
            <AppRouter />
            <Toaster />
          </RealtimeClientProvider>
        </SessionServiceProvider>
      </TradingClientProvider>
    </QueryClientProvider>
  );
}
