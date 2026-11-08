import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { analyticsOperations, type PerformanceResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { periodKey, toPeriodQuery, type AnalyticsPeriod } from "../lib/analytics-period";
import { analyticsKeys } from "./analytics-keys";

const getPerformanceOperation = findOperation(analyticsOperations, "getPortfolioPerformance");

/**
 * The performance of a portfolio over a preset or a custom period: the return of the period, its
 * daily series and whether there is enough data. Changing the period keeps the previous answer on
 * screen while the next one loads. It stays idle while there is no portfolio.
 */
export function usePeriodPerformance(portfolioId: string | undefined, period: AnalyticsPeriod) {
  const client = useTradingClient();

  return useQuery({
    queryKey: [...analyticsKeys.portfolio(portfolioId ?? ""), "performance", periodKey(period)],
    enabled: portfolioId !== undefined && portfolioId !== "",
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = (await client.call(getPerformanceOperation, {
        params: { portfolioId: portfolioId ?? "" },
        query: toPeriodQuery(period),
      })) as { data: PerformanceResponse };
      return data;
    },
  });
}
