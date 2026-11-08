import { InMemoryMarketPriceRepository } from "./in-memory-market-price-repository.js";
import { marketPriceRepositoryContract } from "./contract/index.js";

marketPriceRepositoryContract("InMemoryMarketPriceRepository", () =>
  Promise.resolve({
    repository: new InMemoryMarketPriceRepository(),
    fixtures: { assetId: "asset-1", otherAssetId: "asset-2" },
    cleanup: () => Promise.resolve(),
  }),
);
