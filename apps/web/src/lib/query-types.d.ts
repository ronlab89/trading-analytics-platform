import type { ApiError } from "@/api/trading-client";

declare module "@tanstack/react-query" {
  /** The TradingClient port throws only `ApiError`, so every query and mutation fails with it. */
  interface Register {
    defaultError: ApiError;
  }
}
