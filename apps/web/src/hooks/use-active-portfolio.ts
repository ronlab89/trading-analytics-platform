import { useMemo } from "react";
import { resolveActivePortfolio } from "@/lib/resolve-active-portfolio";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { usePortfolios } from "./use-portfolios";

/**
 * The portfolio the app works on. The list is server state (the query) and the choice is client
 * state (the store); this joins them without copying one into the other. Only active portfolios
 * are offered: an archived one cannot be worked on.
 */
export function useActivePortfolio() {
  const { data, isPending, isError, refetch } = usePortfolios();
  const selectedId = useActivePortfolioStore((state) => state.selectedId);
  const select = useActivePortfolioStore((state) => state.select);

  const portfolios = useMemo(
    () => (data ?? []).filter((portfolio) => portfolio.status === "ACTIVE"),
    [data],
  );
  const active = resolveActivePortfolio(portfolios, selectedId);

  return {
    portfolios,
    active,
    isPending,
    isError,
    select,
    retry: () => {
      void refetch();
    },
  };
}
