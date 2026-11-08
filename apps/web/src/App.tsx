import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router";
import { TradingClientProvider } from "@/api/trading-client-provider";
import { Toaster } from "@/components/ui/sonner";
import { useRealtimeConnection } from "@/hooks/use-realtime-connection";
import { useRealtimeFallback } from "@/hooks/use-realtime-fallback";
import { useRestoreSession } from "@/hooks/use-restore-session";
import { createQueryClient } from "@/lib/query-client";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import type { AppRuntime } from "@/runtime/app-runtime";
import { DemoControlsProvider } from "@/runtime/demo-controls-provider";
import { router } from "@/router";
import { createAppServices } from "@/services/create-app-services";
import { SessionServiceProvider } from "@/services/session/session-provider";

/** Inside the providers, so it can reach the session service. */
function AppRouter() {
  useRestoreSession();
  useRealtimeConnection();
  useRealtimeFallback();
  return <RouterProvider router={router} />;
}

export function App({ runtime }: { runtime: AppRuntime }) {
  const [queryClient] = useState(createQueryClient);
  const [services] = useState(() => createAppServices(runtime.tradingClient));

  return (
    <QueryClientProvider client={queryClient}>
      <TradingClientProvider client={services.client}>
        <SessionServiceProvider service={services.session}>
          <RealtimeClientProvider client={runtime.realtimeClient}>
            <DemoControlsProvider controls={runtime.demoControls}>
              <AppRouter />
              <Toaster />
            </DemoControlsProvider>
          </RealtimeClientProvider>
        </SessionServiceProvider>
      </TradingClientProvider>
    </QueryClientProvider>
  );
}
