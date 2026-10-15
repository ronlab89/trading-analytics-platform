import { InMemoryUserPreferenceRepository } from "./in-memory-user-preference-repository.js";
import { userPreferenceRepositoryContract } from "./contract/index.js";

userPreferenceRepositoryContract("InMemoryUserPreferenceRepository", () =>
  Promise.resolve({
    repository: new InMemoryUserPreferenceRepository(),
    fixtures: { userId: "user-1", otherUserId: "user-2" },
    cleanup: () => Promise.resolve(),
  }),
);
