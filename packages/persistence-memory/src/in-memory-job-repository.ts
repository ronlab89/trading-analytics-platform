import type {
  CreateJobInput,
  Job,
  JobRepository,
  JobStatus,
  TransitionJobInput,
} from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/** Opaque copy of the repository state, for `snapshot` and `restore`. */
export interface InMemoryJobSnapshot {
  readonly rows: ReadonlyMap<string, Job>;
  readonly sequence: number;
}

/**
 * In-memory implementation of `JobRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: `id` is assigned here, a new job is `QUEUED` in
 * its first attempt with no progress, failure or report, and `updatedAt`
 * starts at `createdAt`. `transition` compares status, stage and attempt and
 * writes in the same synchronous step, so it is a compare-and-set like the
 * conditional update in Postgres.
 */
export class InMemoryJobRepository implements JobRepository {
  private readonly rows = new Map<string, Job>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  /** Captures the current state; used by the unit of work to roll back. */
  snapshot(): InMemoryJobSnapshot {
    return { rows: new Map(this.rows), sequence: this.sequence };
  }

  /** Replaces the current state with a snapshot; the snapshot stays reusable. */
  restore(snapshot: InMemoryJobSnapshot): void {
    this.rows.clear();
    for (const [id, row] of snapshot.rows) {
      this.rows.set(id, row);
    }
    this.sequence = snapshot.sequence;
  }

  create(input: CreateJobInput): Promise<Job> {
    const createdAt = this.now();
    const job: Job = {
      id: `job_${String(++this.sequence)}`,
      userId: input.userId,
      portfolioId: input.portfolioId,
      type: input.type,
      status: "QUEUED",
      stage: "QUEUED",
      attempt: 1,
      processed: 0,
      total: 0,
      failureReason: null,
      report: null,
      input: input.input,
      queuedAt: input.queuedAt,
      deadlineAt: input.deadlineAt,
      createdAt,
      updatedAt: createdAt,
      finishedAt: null,
    };
    this.rows.set(job.id, job);

    return Promise.resolve(job);
  }

  getById(id: string): Promise<Job | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  listByStatuses(statuses: readonly JobStatus[]): Promise<Job[]> {
    const matching = [...this.rows.values()]
      .filter((job) => statuses.includes(job.status))
      .sort(
        (a, b) =>
          a.queuedAt.getTime() - b.queuedAt.getTime() ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      );

    return Promise.resolve(matching);
  }

  transition(input: TransitionJobInput): Promise<Job | null> {
    const current = this.rows.get(input.id);

    if (
      current?.status !== input.expected.status ||
      current.stage !== input.expected.stage ||
      current.attempt !== input.expected.attempt
    ) {
      return Promise.resolve(null);
    }

    const updated: Job = { ...current, ...definedFields(input.patch), updatedAt: input.updatedAt };
    this.rows.set(updated.id, updated);

    return Promise.resolve(updated);
  }
}

/** A patch changes the fields it names, `null` included, and leaves the rest alone. */
function definedFields<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
