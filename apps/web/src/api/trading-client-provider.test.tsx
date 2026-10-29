import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { TradingClientProvider, useTradingClient } from "./trading-client-provider";
import type { TradingClient } from "./trading-client";

describe("useTradingClient", () => {
  it("returns the client the provider holds", () => {
    const client: TradingClient = { call: () => Promise.resolve(undefined) };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TradingClientProvider client={client}>{children}</TradingClientProvider>
    );

    const { result } = renderHook(() => useTradingClient(), { wrapper });

    expect(result.current).toBe(client);
  });

  it("fails loudly outside a provider", () => {
    expect(() => renderHook(() => useTradingClient())).toThrow(
      "useTradingClient must be used inside a TradingClientProvider",
    );
  });
});
