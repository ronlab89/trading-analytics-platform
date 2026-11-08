import { InMemoryDecisionRepository } from "./in-memory-decision-repository.js";
import { decisionRepositoryContract } from "./contract/index.js";

decisionRepositoryContract("InMemoryDecisionRepository", () =>
  Promise.resolve({
    repository: new InMemoryDecisionRepository(),
    fixtures: {
      portfolioId: "portfolio-1",
      otherPortfolioId: "portfolio-2",
      assetId: "asset-1",
      otherAssetId: "asset-2",
    },
    cleanup: () => Promise.resolve(),
  }),
);
