import type { PortfolioResponse } from "@trading/contracts";

/**
 * The portfolio the app works on: the selected one while it still exists and is active,
 * otherwise the first active one. An archived portfolio is never the active one.
 */
export function resolveActivePortfolio(
  portfolios: readonly PortfolioResponse[],
  selectedId: string | undefined,
): PortfolioResponse | undefined {
  const active = portfolios.filter((portfolio) => portfolio.status === "ACTIVE");
  return active.find((portfolio) => portfolio.id === selectedId) ?? active[0];
}
