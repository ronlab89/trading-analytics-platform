import { InMemoryNotificationRepository } from "./in-memory-notification-repository.js";
import { notificationRepositoryContract } from "./contract/index.js";

notificationRepositoryContract("InMemoryNotificationRepository", () =>
  Promise.resolve({
    repository: new InMemoryNotificationRepository(),
    fixtures: { userId: "user-1", otherUserId: "user-2" },
    cleanup: () => Promise.resolve(),
  }),
);
