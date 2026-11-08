import { ScenarioStatus } from "@trading/domain";
import type {
  CreateScenarioInput,
  Scenario,
  ScenarioChange,
  ScenarioRepository,
} from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

type ScenarioUpdate = Partial<Pick<Scenario, "name" | "description" | "status" | "changes">>;

interface StoredScenario {
  readonly scenario: Scenario;
  /** Creation order, the tie-break between scenarios that share a `createdAt`. */
  readonly sequence: number;
}

/**
 * In-memory implementation of `ScenarioRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: a new scenario is DRAFT with no description,
 * snapshot or changes; the list is newest first and, for scenarios created at
 * the same instant, oldest created first (Prisma orders by `id asc`); `update`
 * ignores undefined fields; and `update`, `updateChanges` and `delete` throw
 * when the row does not exist.
 */
export class InMemoryScenarioRepository implements ScenarioRepository {
  private readonly rows = new Map<string, StoredScenario>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  listByPortfolioId(portfolioId: string): Promise<Scenario[]> {
    const found = [...this.rows.values()]
      .filter(({ scenario }) => scenario.portfolioId === portfolioId)
      .sort(
        (a, b) =>
          b.scenario.createdAt.getTime() - a.scenario.createdAt.getTime() ||
          a.sequence - b.sequence,
      );

    return Promise.resolve(found.map((stored) => stored.scenario));
  }

  getById(id: string): Promise<Scenario | null> {
    return Promise.resolve(this.rows.get(id)?.scenario ?? null);
  }

  create(input: CreateScenarioInput): Promise<Scenario> {
    const timestamp = this.now();
    const sequence = ++this.sequence;

    const scenario: Scenario = {
      id: `scenario_${String(sequence)}`,
      portfolioId: input.portfolioId,
      name: input.name,
      description: input.description ?? null,
      baseSnapshotId: input.baseSnapshotId ?? null,
      status: input.status ?? ScenarioStatus.DRAFT,
      changes: input.changes ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.rows.set(scenario.id, { scenario, sequence });

    return Promise.resolve(scenario);
  }

  update(id: string, input: ScenarioUpdate): Promise<Scenario> {
    // Prisma ignores undefined fields; the type forbids them, but callers can still pass one.
    const changes = Object.fromEntries(
      Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined),
    ) as ScenarioUpdate;

    return this.change(id, changes);
  }

  updateChanges(id: string, changes: readonly ScenarioChange[]): Promise<Scenario> {
    return this.change(id, { changes });
  }

  delete(id: string): Promise<void> {
    if (!this.rows.delete(id)) {
      return Promise.reject(new Error(`Scenario ${id} does not exist.`));
    }

    return Promise.resolve();
  }

  private change(id: string, changes: ScenarioUpdate): Promise<Scenario> {
    const existing = this.rows.get(id);

    if (!existing) {
      return Promise.reject(new Error(`Scenario ${id} does not exist.`));
    }

    const scenario: Scenario = { ...existing.scenario, ...changes, updatedAt: this.now() };
    this.rows.set(id, { scenario, sequence: existing.sequence });

    return Promise.resolve(scenario);
  }
}
