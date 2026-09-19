/**
 * Portfolio blueprints for the seed dataset.
 *
 * `userId` is deliberately omitted here — it is only known at seed time,
 * after the demo user has been created. The seed step assembles the full
 * `CreatePortfolioInput` by combining a blueprint with the created user's id.
 *
 * Source: 12-demo-mode-spec.md §13 — "2+ portfolios", plus an intentionally
 * empty portfolio to exercise empty states (05-data-model.md §33-37).
 */
export interface PortfolioBlueprint {
  readonly name: string;
  readonly baseCurrency: string;
  readonly description?: string;
}

export const SEED_PORTFOLIOS: readonly PortfolioBlueprint[] = [
  {
    name: "Main Portfolio",
    baseCurrency: "USD",
    description: "Primary long-term holdings across equities and ETFs.",
  },
  {
    name: "Crypto Experimental",
    baseCurrency: "USD",
    description: "Higher-volatility crypto positions, actively managed.",
  },
  {
    name: "Empty Portfolio",
    baseCurrency: "USD",
    description: "Intentionally empty — exercises empty-state UI (FR-058).",
  },
];
