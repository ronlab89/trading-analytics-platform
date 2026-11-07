import type { AssetRepository, WatchlistItemRepository } from "@trading/domain";

/** AAPL stays out on purpose: the demo user adds it to see the flow. */
const SEED_SYMBOLS: readonly string[] = ["NVDA", "SPY", "ETH"];

export interface WatchlistSeedDependencies {
  readonly watchlistRepository: Pick<WatchlistItemRepository, "create">;
  readonly assetRepository: Pick<AssetRepository, "getBySymbol">;
  readonly userId: string;
}

/** Writes straight to the repository, like the alerts: the watchlist exists before the first call. */
export async function seedWatchlist(dependencies: WatchlistSeedDependencies): Promise<void> {
  const { watchlistRepository, assetRepository, userId } = dependencies;

  for (const symbol of SEED_SYMBOLS) {
    const asset = await assetRepository.getBySymbol(symbol);
    if (!asset) continue;
    await watchlistRepository.create({ userId, assetId: asset.id });
  }
}
