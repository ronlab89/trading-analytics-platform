import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { analyticsOperations, type RangeAttributionResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { periodKey, toPeriodQuery, type AnalyticsPeriod } from "../lib/analytics-period";
import { analyticsKeys } from "./analytics-keys";

const getAttributionOperation = findOperation(analyticsOperations, "getPortfolioAttribution");

/**
 * What each asset added to the result of a preset or a custom period, in money. Asking with a period
 * is what makes the API answer over the range (without one it answers the unrealized P/L today).
 * Changing the period keeps the previous answer on screen while the next one loads. It stays idle
 * while there is no portfolio.
 */
export function useAttribution(portfolioId: string | undefined, period: AnalyticsPeriod) {
  const client = useTradingClient();

  return useQuery({
    queryKey: [...analyticsKeys.portfolio(portfolioId ?? ""), "attribution", periodKey(period)],
    enabled: portfolioId !== undefined && portfolioId !== "",
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = (await client.call(getAttributionOperation, {
        params: { portfolioId: portfolioId ?? "" },
        query: { ...toPeriodQuery(period), groupBy: "asset" },
      })) as { data: RangeAttributionResponse };
      return data;
    },
  });
}
