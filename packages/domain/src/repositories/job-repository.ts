import type { CreateJobInput, Job, JobStatus, TransitionJobInput } from "../entities/job.js";

/**
 * Job repository contract.
 * Source: ADR-008 points 4-7 and Deferred detail (racing transitions),
 * docs/05-data-model.md.
 *
 * Every change after creation goes through `transition`, a compare-and-set:
 * it applies only when the job still has the status, stage and attempt the
 * caller expects, so a resume racing an enqueue, or a cancel racing a
 * committed apply, loses instead of overwriting. Whether a status change is
 * allowed at all is the caller's rule (`isJobTransitionAllowed`); the
 * repository only guarantees the compare. Time always comes from the caller.
 */
export interface JobRepository {
  /**
   * Creates a `QUEUED` job in its first attempt. Callers are expected to
   * have run `validateNewJob`.
   */
  create(input: CreateJobInput): Promise<Job>;

  /** Returns the job, or null if it does not exist. */
  getById(id: string): Promise<Job | null>;

  /** Returns the jobs in any of the given statuses, oldest `queuedAt` first. */
  listByStatuses(statuses: readonly JobStatus[]): Promise<Job[]>;

  /**
   * Applies `patch` and `updatedAt` when the stored job still matches
   * `expected`, and returns the updated job. Resolves null, changing nothing,
   * when no row matches (the job moved on, or does not exist).
   */
  transition(input: TransitionJobInput): Promise<Job | null>;
}
