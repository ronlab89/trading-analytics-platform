import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { analyticsKeys } from "@/features/analytics/hooks/analytics-keys";
import { overviewKeys } from "@/features/dashboard/hooks/use-overview";
import { performanceKeys } from "@/features/dashboard/hooks/use-performance";
import { transactionKeys } from "@/features/transactions/hooks/use-transactions";
import { portfolioKeys } from "@/hooks/use-portfolios";
import { invalidatePortfolioData } from "./invalidate-portfolio-data";

function setup() {
  const queryClient = new QueryClient();
  const keys = {
    transactions: transactionKeys.list("p1", { page: 2, pageSize: 10 }),
    positions: portfolioKeys.positions("p1"),
    overview: overviewKeys.portfolio("p1"),
    performance: performanceKeys.period("p1", "1M"),
    analytics: [...analyticsKeys.portfolio("p1"), "risk", "3M"],
    otherPortfolio: overviewKeys.portfolio("p2"),
    detail: portfolioKeys.detail("p1"),
  };
  Object.values(keys).forEach((queryKey) => {
    queryClient.setQueryData(queryKey, "data");
  });
  const stale = (queryKey: readonly unknown[]) =>
    queryClient.getQueryState(queryKey)?.isInvalidated;
  return { queryClient, keys, stale };
}

describe("invalidatePortfolioData", () => {
  it("marks as stale the transactions, positions, overview, performance and analytics of the portfolio", () => {
    const { queryClient, keys, stale } = setup();

    invalidatePortfolioData(queryClient, "p1");

    expect(stale(keys.transactions)).toBe(true);
    expect(stale(keys.positions)).toBe(true);
    expect(stale(keys.overview)).toBe(true);
    expect(stale(keys.performance)).toBe(true);
    expect(stale(keys.analytics)).toBe(true);
  });

  it("leaves another portfolio and the portfolio record itself alone", () => {
    const { queryClient, keys, stale } = setup();

    invalidatePortfolioData(queryClient, "p1");

    expect(stale(keys.otherPortfolio)).toBe(false);
    expect(stale(keys.detail)).toBe(false);
  });
});
