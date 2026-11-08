import { InMemoryTransactionRepository } from "./in-memory-transaction-repository.js";
import { transactionRepositoryContract } from "./contract/index.js";

transactionRepositoryContract("InMemoryTransactionRepository", () =>
  Promise.resolve({
    repository: new InMemoryTransactionRepository(),
    fixtures: {
      portfolioId: "portfolio-1",
      otherPortfolioId: "portfolio-2",
      assetId: "asset-1",
      otherAssetId: "asset-2",
    },
    cleanup: () => Promise.resolve(),
  }),
);
