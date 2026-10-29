import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { TradingClientProvider } from "@/api/trading-client-provider";
import type { TradingClient } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";

/** The providers a query hook needs: the given `TradingClient` and a fresh query cache. */
export function tradingClientWrapper(
  client: TradingClient,
  queryClient: QueryClient = createQueryClient(),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TradingClientProvider client={client}>{children}</TradingClientProvider>
      </QueryClientProvider>
    );
  };
}
