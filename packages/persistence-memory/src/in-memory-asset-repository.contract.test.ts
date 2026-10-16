import { InMemoryAssetRepository } from "./in-memory-asset-repository.js";
import { assetRepositoryContract } from "./contract/index.js";

assetRepositoryContract("InMemoryAssetRepository", () =>
  Promise.resolve({
    repository: new InMemoryAssetRepository(),
    cleanup: () => Promise.resolve(),
  }),
);
