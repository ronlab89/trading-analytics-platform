import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { TradingClientProvider } from "@/api/trading-client-provider";
import type { TradingClient } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";
import type { RealtimeClient } from "@/realtime/realtime-client";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createFakeRealtimeClient } from "./fake-realtime-client";

/**
 * The providers a query hook needs: the given `TradingClient`, a fresh query cache and a realtime
 * client that never delivers anything (pass one to drive the events of a test).
 */
export function tradingClientWrapper(
  client: TradingClient,
  queryClient: QueryClient = createQueryClient(),
  realtimeClient: RealtimeClient = createFakeRealtimeClient(),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TradingClientProvider client={client}>
          <RealtimeClientProvider client={realtimeClient}>{children}</RealtimeClientProvider>
        </TradingClientProvider>
      </QueryClientProvider>
    );
  };
}
