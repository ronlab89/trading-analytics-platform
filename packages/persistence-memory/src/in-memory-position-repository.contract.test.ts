import { InMemoryPositionRepository } from "./in-memory-position-repository.js";
import { positionRepositoryContract } from "./contract/index.js";

positionRepositoryContract("InMemoryPositionRepository", () =>
  Promise.resolve({
    repository: new InMemoryPositionRepository(),
    fixtures: {
      portfolioId: "portfolio-1",
      otherPortfolioId: "portfolio-2",
      assetId: "asset-1",
      otherAssetId: "asset-2",
    },
    cleanup: () => Promise.resolve(),
  }),
);
