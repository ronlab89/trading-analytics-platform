import { InMemoryIdempotencyKeyRepository } from "./in-memory-idempotency-key-repository.js";
import { idempotencyKeyRepositoryContract } from "./contract/index.js";

idempotencyKeyRepositoryContract("InMemoryIdempotencyKeyRepository", () =>
  Promise.resolve({
    repository: new InMemoryIdempotencyKeyRepository(),
    fixtures: { userId: "user-1", otherUserId: "user-2" },
    cleanup: () => Promise.resolve(),
  }),
);
