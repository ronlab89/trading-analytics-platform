import { InMemoryHistoricalPriceRepository } from "./in-memory-historical-price-repository.js";
import { historicalPriceRepositoryContract } from "./contract/index.js";

historicalPriceRepositoryContract("InMemoryHistoricalPriceRepository", () =>
  Promise.resolve({
    repository: new InMemoryHistoricalPriceRepository(),
    fixtures: { assetId: "asset-1", otherAssetId: "asset-2" },
    cleanup: () => Promise.resolve(),
  }),
);
