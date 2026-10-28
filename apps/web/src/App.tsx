import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router";
import { createHttpTradingClient } from "@/api/http-trading-client";
import { TradingClientProvider } from "@/api/trading-client-provider";
import { env } from "@/config/env";
import { useRestoreSession } from "@/hooks/use-restore-session";
import { createQueryClient } from "@/lib/query-client";
import { router } from "@/router";
import { createAppServices } from "@/services/create-app-services";
import { SessionServiceProvider } from "@/services/session/session-provider";
import { getAccessToken } from "@/stores/session-store";

/** Inside the providers, so it can reach the session service. */
function AppRouter() {
  useRestoreSession();
  return <RouterProvider router={router} />;
}

function createServices() {
  return createAppServices(
    createHttpTradingClient({ baseUrl: env.VITE_API_BASE_URL, getAccessToken }),
  );
}

export function App() {
  const [queryClient] = useState(createQueryClient);
  const [services] = useState(createServices);

  return (
    <QueryClientProvider client={queryClient}>
      <TradingClientProvider client={services.client}>
        <SessionServiceProvider service={services.session}>
          <AppRouter />
        </SessionServiceProvider>
      </TradingClientProvider>
    </QueryClientProvider>
  );
}
