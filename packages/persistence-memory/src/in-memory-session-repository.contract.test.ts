import { InMemorySessionRepository } from "./in-memory-session-repository.js";
import { sessionRepositoryContract } from "./contract/index.js";

sessionRepositoryContract("InMemorySessionRepository", () =>
  Promise.resolve({
    repository: new InMemorySessionRepository(),
    fixtures: { userId: "user-1" },
    cleanup: () => Promise.resolve(),
  }),
);
