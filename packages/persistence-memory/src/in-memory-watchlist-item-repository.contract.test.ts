import { InMemoryWatchlistItemRepository } from "./in-memory-watchlist-item-repository.js";
import { watchlistItemRepositoryContract } from "./contract/index.js";

watchlistItemRepositoryContract("InMemoryWatchlistItemRepository", () =>
  Promise.resolve({
    repository: new InMemoryWatchlistItemRepository(),
    fixtures: {
      userId: "user-1",
      otherUserId: "user-2",
      assetId: "asset-1",
      otherAssetId: "asset-2",
    },
    cleanup: () => Promise.resolve(),
  }),
);
