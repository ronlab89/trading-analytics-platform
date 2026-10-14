import type {
  CreateDecisionEventInput,
  DecisionEvent,
  DecisionEventRepository,
} from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/**
 * In-memory implementation of `DecisionEventRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: events are immutable, the payload defaults to
 * `{}`, the timestamp defaults to now (or the historical value the caller
 * passes), and a decision's events are listed oldest first.
 *
 * Known difference: Prisma rejects an event whose `decisionId` does not exist
 * (foreign key). This repository is independent of the decision repository and
 * cannot check it.
 */
export class InMemoryDecisionEventRepository implements DecisionEventRepository {
  /** Insertion order is the tie-break between events that share a timestamp. */
  private readonly rows: DecisionEvent[] = [];
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  listByDecisionId(decisionId: string): Promise<DecisionEvent[]> {
    const found = this.rows
      .filter((event) => event.decisionId === decisionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return Promise.resolve(found);
  }

  create(input: CreateDecisionEventInput): Promise<DecisionEvent> {
    const event: DecisionEvent = {
      id: `decision_event_${String(++this.sequence)}`,
      decisionId: input.decisionId,
      timestamp: input.timestamp ?? this.now(),
      type: input.type,
      payload: input.payload ?? {},
    };
    this.rows.push(event);

    return Promise.resolve(event);
  }
}
