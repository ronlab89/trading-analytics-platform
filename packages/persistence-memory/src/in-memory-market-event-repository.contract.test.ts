import { InMemoryMarketEventRepository } from "./in-memory-market-event-repository.js";
import { marketEventRepositoryContract } from "./contract/index.js";

marketEventRepositoryContract("InMemoryMarketEventRepository", () =>
  Promise.resolve({
    repository: new InMemoryMarketEventRepository(),
    fixtures: { assetId: "asset-1", otherAssetId: "asset-2" },
    cleanup: () => Promise.resolve(),
  }),
);
