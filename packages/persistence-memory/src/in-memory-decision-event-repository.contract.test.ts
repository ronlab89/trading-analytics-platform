import { InMemoryDecisionEventRepository } from "./in-memory-decision-event-repository.js";
import { decisionEventRepositoryContract } from "./contract/index.js";

decisionEventRepositoryContract("InMemoryDecisionEventRepository", () =>
  Promise.resolve({
    repository: new InMemoryDecisionEventRepository(),
    fixtures: { decisionId: "decision-1", otherDecisionId: "decision-2" },
    cleanup: () => Promise.resolve(),
  }),
);
