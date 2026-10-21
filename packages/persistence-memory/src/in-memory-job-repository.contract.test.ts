import { InMemoryJobRepository } from "./in-memory-job-repository.js";
import { jobRepositoryContract } from "./contract/index.js";

jobRepositoryContract("InMemoryJobRepository", () =>
  Promise.resolve({
    repository: new InMemoryJobRepository(),
    fixtures: { userId: "user-1", portfolioId: "portfolio-1" },
    cleanup: () => Promise.resolve(),
  }),
);
