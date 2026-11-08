import type { QueryClient } from "@tanstack/react-query";
import { analyticsKeys } from "@/features/analytics/hooks/analytics-keys";
import { overviewKeys } from "@/features/dashboard/hooks/use-overview";
import { performanceKeys } from "@/features/dashboard/hooks/use-performance";
import { transactionKeys } from "@/features/transactions/hooks/use-transactions";
import { portfolioKeys } from "@/hooks/use-portfolios";

/**
 * Marks as stale everything the holdings of a portfolio change, so what is on screen is read again:
 * the pages of transactions, the positions, the dashboard overview, the performance series and the
 * analytics panels (whatever their period). Used when a transaction is recorded here and when the
 * server says the portfolio changed.
 */
export function invalidatePortfolioData(queryClient: QueryClient, portfolioId: string): void {
  void queryClient.invalidateQueries({ queryKey: transactionKeys.portfolio(portfolioId) });
  void queryClient.invalidateQueries({ queryKey: portfolioKeys.positions(portfolioId) });
  void queryClient.invalidateQueries({ queryKey: overviewKeys.portfolio(portfolioId) });
  void queryClient.invalidateQueries({ queryKey: performanceKeys.portfolio(portfolioId) });
  void queryClient.invalidateQueries({ queryKey: analyticsKeys.portfolio(portfolioId) });
}
