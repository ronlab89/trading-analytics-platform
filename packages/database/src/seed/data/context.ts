/**
 * Shared context threaded through seed steps.
 *
 * Each seed step (users, portfolios, assets, positions, ...) receives the
 * context produced by previous steps and returns an updated copy. This
 * avoids re-querying the database mid-seed just to discover ids we already
 * generated moments ago.
 */
export interface SeedContext {
  userId?: string;
  portfolioIds: string[];
  assetIds: string[];
}

export function createEmptySeedContext(): SeedContext {
  return {
    portfolioIds: [],
    assetIds: [],
  };
}
