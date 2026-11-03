import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { analyticsOperations, type RiskResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { periodKey, toPeriodQuery, type AnalyticsPeriod } from "../lib/analytics-period";
import { analyticsKeys } from "./analytics-keys";

const getRiskOperation = findOperation(analyticsOperations, "getPortfolioRisk");

/**
 * The risk of a portfolio over a period: its annualized volatility and its drawdown, with the dates
 * of the peak and the trough. Changing the period keeps the previous answer on screen while the next
 * one loads. It stays idle while there is no portfolio.
 */
export function useRisk(portfolioId: string | undefined, period: AnalyticsPeriod) {
  const client = useTradingClient();

  return useQuery({
    queryKey: [...analyticsKeys.portfolio(portfolioId ?? ""), "risk", periodKey(period)],
    enabled: portfolioId !== undefined && portfolioId !== "",
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = (await client.call(getRiskOperation, {
        params: { portfolioId: portfolioId ?? "" },
        query: toPeriodQuery(period),
      })) as { data: RiskResponse };
      return data;
    },
  });
}
