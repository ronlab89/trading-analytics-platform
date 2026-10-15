import { InMemoryUserRepository } from "./in-memory-user-repository.js";
import { userRepositoryContract } from "./contract/index.js";

userRepositoryContract("InMemoryUserRepository", () =>
  Promise.resolve({
    repository: new InMemoryUserRepository(),
    cleanup: () => Promise.resolve(),
  }),
);
