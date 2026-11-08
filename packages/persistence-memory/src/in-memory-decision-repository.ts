import type {
  CreateDecisionInput,
  Decision,
  DecisionDirection,
  DecisionRepository,
} from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

type DecisionUpdate = Partial<
  Pick<Decision, "title" | "thesis" | "targetPrice" | "stopPrice" | "riskLevel" | "notes">
>;

interface StoredDecision {
  readonly decision: Decision;
  /** Creation order, the tie-break between decisions that share a `createdAt`. */
  readonly sequence: number;
}

/**
 * In-memory implementation of `DecisionRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: optional fields default to null, `createdAt`
 * defaults to now (or the historical value the caller passes), the list is
 * newest first and filtered by asset, direction and an inclusive `createdAt`
 * range, `update` ignores undefined fields and clears a price with null, and
 * `update` and `close` throw when the row does not exist.
 */
export class InMemoryDecisionRepository implements DecisionRepository {
  private readonly rows = new Map<string, StoredDecision>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  listByPortfolioId(
    portfolioId: string,
    filter?: {
      assetId?: string;
      direction?: DecisionDirection;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ): Promise<Decision[]> {
    const found = [...this.rows.values()]
      .filter(
        ({ decision: d }) =>
          d.portfolioId === portfolioId &&
          (filter?.assetId === undefined || d.assetId === filter.assetId) &&
          (filter?.direction === undefined || d.direction === filter.direction) &&
          (filter?.dateFrom === undefined || d.createdAt.getTime() >= filter.dateFrom.getTime()) &&
          (filter?.dateTo === undefined || d.createdAt.getTime() <= filter.dateTo.getTime()),
      )
      .sort(
        (a, b) =>
          b.decision.createdAt.getTime() - a.decision.createdAt.getTime() ||
          b.sequence - a.sequence,
      );

    return Promise.resolve(found.map((stored) => stored.decision));
  }

  getById(id: string): Promise<Decision | null> {
    return Promise.resolve(this.rows.get(id)?.decision ?? null);
  }

  create(input: CreateDecisionInput): Promise<Decision> {
    const sequence = ++this.sequence;

    const decision: Decision = {
      id: `decision_${String(sequence)}`,
      portfolioId: input.portfolioId,
      assetId: input.assetId,
      title: input.title,
      thesis: input.thesis,
      direction: input.direction,
      entryPrice: input.entryPrice ?? null,
      targetPrice: input.targetPrice ?? null,
      stopPrice: input.stopPrice ?? null,
      riskLevel: input.riskLevel ?? null,
      createdAt: input.createdAt ?? this.now(),
      closedAt: null,
      outcome: null,
      notes: input.notes ?? null,
    };
    this.rows.set(decision.id, { decision, sequence });

    return Promise.resolve(decision);
  }

  update(id: string, input: DecisionUpdate): Promise<Decision> {
    const existing = this.rows.get(id);

    if (!existing) {
      return Promise.reject(new Error(`Decision ${id} does not exist.`));
    }

    // Prisma ignores undefined fields; the type forbids them, but callers can still pass one.
    const changes = Object.fromEntries(
      Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined),
    ) as DecisionUpdate;
    const decision: Decision = { ...existing.decision, ...changes };
    this.rows.set(id, { decision, sequence: existing.sequence });

    return Promise.resolve(decision);
  }

  close(id: string, outcome: string, closedAt: Date): Promise<Decision> {
    const existing = this.rows.get(id);

    if (!existing) {
      return Promise.reject(new Error(`Decision ${id} does not exist.`));
    }

    const decision: Decision = { ...existing.decision, outcome, closedAt };
    this.rows.set(id, { decision, sequence: existing.sequence });

    return Promise.resolve(decision);
  }
}
