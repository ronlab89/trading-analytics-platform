import { InMemoryAlertRepository } from "./in-memory-alert-repository.js";
import { alertRepositoryContract } from "./contract/index.js";

alertRepositoryContract("InMemoryAlertRepository", () =>
  Promise.resolve({
    repository: new InMemoryAlertRepository(),
    fixtures: {
      userId: "user-1",
      otherUserId: "user-2",
      assetId: "asset-1",
      portfolioId: "portfolio-1",
    },
    cleanup: () => Promise.resolve(),
  }),
);
