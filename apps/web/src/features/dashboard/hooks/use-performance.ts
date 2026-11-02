import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  analyticsOperations,
  type analyticsPeriodQuerySchema,
  type PerformanceResponse,
} from "@trading/contracts";
import type { z } from "zod";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const getPerformanceOperation = findOperation(analyticsOperations, "getPortfolioPerformance");

/** The preset periods the API accepts (`1W`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `ALL`), read from its schema. */
export type PerformancePeriod = NonNullable<z.input<typeof analyticsPeriodQuerySchema>["period"]>;

/** Query keys of the performance series, so a change to a portfolio can invalidate every period. */
export const performanceKeys = {
  all: ["performance"] as const,
  portfolio: (portfolioId: string) => [...performanceKeys.all, portfolioId] as const,
  period: (portfolioId: string, period: PerformancePeriod) =>
    [...performanceKeys.portfolio(portfolioId), period] as const,
};

/**
 * The performance of a portfolio over a preset period: its daily value and return. The charts of
 * the dashboard each ask for the period they need. Changing the period keeps the previous series
 * on screen while the next one loads, so the chart does not flash empty. It stays idle while there
 * is no portfolio.
 */
export function usePerformance(portfolioId: string | undefined, period: PerformancePeriod) {
  const client = useTradingClient();

  return useQuery({
    queryKey: performanceKeys.period(portfolioId ?? "", period),
    enabled: portfolioId !== undefined && portfolioId !== "",
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = (await client.call(getPerformanceOperation, {
        params: { portfolioId: portfolioId ?? "" },
        query: { period },
      })) as { data: PerformanceResponse };
      return data;
    },
  });
}
