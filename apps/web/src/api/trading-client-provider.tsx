import { createContext, use, type ReactNode } from "react";
import type { TradingClient } from "./trading-client";

const TradingClientContext = createContext<TradingClient | undefined>(undefined);

interface TradingClientProviderProps {
  client: TradingClient;
  children: ReactNode;
}

/** Hands the one `TradingClient` of the app to the query hooks, so a test can swap it. */
export function TradingClientProvider({ client, children }: TradingClientProviderProps) {
  return <TradingClientContext value={client}>{children}</TradingClientContext>;
}

export function useTradingClient(): TradingClient {
  const client = use(TradingClientContext);
  if (!client) {
    throw new Error("useTradingClient must be used inside a TradingClientProvider");
  }
  return client;
}
