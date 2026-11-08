import { InMemoryScenarioRepository } from "./in-memory-scenario-repository.js";
import { scenarioRepositoryContract } from "./contract/index.js";

scenarioRepositoryContract("InMemoryScenarioRepository", () =>
  Promise.resolve({
    repository: new InMemoryScenarioRepository(),
    fixtures: { portfolioId: "portfolio-1", otherPortfolioId: "portfolio-2" },
    cleanup: () => Promise.resolve(),
  }),
);
