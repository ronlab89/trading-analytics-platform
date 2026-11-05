import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent } from "react";
import { useRealtimeClient } from "@/realtime/realtime-client-provider";
import { invalidatePortfolioData } from "../lib/invalidate-portfolio-data";

/**
 * Reads a portfolio again when the server says its holdings changed: it listens to the portfolio
 * channel while the component is mounted, and every `PORTFOLIO_UPDATED` marks the data of that
 * portfolio as stale. The event carries no data, so the screens that show it fetch it over HTTP.
 * It listens to nothing while there is no portfolio.
 */
export function usePortfolioUpdates(portfolioId: string | undefined): void {
  const client = useRealtimeClient();
  const queryClient = useQueryClient();
  const subscribe = useEffectEvent(() => {
    if (portfolioId === undefined || portfolioId === "") return undefined;
    return client.subscribe({ kind: "portfolio", portfolioId }, (event) => {
      if (event.type === "PORTFOLIO_UPDATED") {
        invalidatePortfolioData(queryClient, event.payload.portfolioId);
      }
    });
  });

  useEffect(() => subscribe(), [client, portfolioId]);
}
