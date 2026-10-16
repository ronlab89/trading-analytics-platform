import { InMemoryCredentialRepository } from "./in-memory-credential-repository.js";
import { credentialRepositoryContract } from "./contract/index.js";

credentialRepositoryContract("InMemoryCredentialRepository", () =>
  Promise.resolve({
    repository: new InMemoryCredentialRepository(),
    fixtures: { userId: "user-1", otherUserId: "user-2" },
    cleanup: () => Promise.resolve(),
  }),
);
