import { InMemoryPortfolioRepository } from "./in-memory-portfolio-repository.js";
import { portfolioRepositoryContract } from "./contract/index.js";

portfolioRepositoryContract("InMemoryPortfolioRepository", () =>
  Promise.resolve({
    repository: new InMemoryPortfolioRepository(),
    fixtures: { userId: "user-1", otherUserId: "user-2" },
    cleanup: () => Promise.resolve(),
  }),
);
