export interface SeedPortfolioRef {
  readonly id: string;
  readonly name: string;
}

export interface SeedAssetRef {
  readonly id: string;
  readonly symbol: string;
}

/**
 * Shared context threaded through seed steps.
 *
 * Each seed step (users, portfolios, assets, positions, ...) receives the
 * context produced by previous steps and returns an updated copy. Storing
 * {id, name}/{id, symbol} pairs (not just bare ids) lets later steps resolve
 * "Main Portfolio" or "BTC" to their real database id without re-querying —
 * seed data files reference entities by human-readable name/symbol, which
 * is what makes them reviewable in the first place.
 */
export interface SeedContext {
  userId?: string;
  portfolios: SeedPortfolioRef[];
  assets: SeedAssetRef[];
}

export function createEmptySeedContext(): SeedContext {
  return {
    portfolios: [],
    assets: [],
  };
}
