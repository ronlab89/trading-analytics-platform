import { JobFailureReason, JobStage, JobStatus } from "@trading/domain";
import type { Job, JobExpectation, JobRepository, JobRowError, JobType } from "@trading/domain";
import type { Clock } from "./clock.js";

/** A background pass that fails is retried by the next poll; there is no caller to tell. */
const ignore = (): void => undefined;

/** How often the runner looks for queued work and for queued jobs past their deadline. */
export const DEFAULT_JOB_POLL_INTERVAL_MS = 1000;

/** What validating a job found: the rows it counted and the rows that failed. */
export interface JobValidationResult {
  readonly total: number;
  readonly errors: readonly JobRowError[];
}

/**
 * Reports validation progress. Resolves false once the job is no longer
 * validating (cancelled or timed out): the handler should stop.
 */
export type JobProgressReporter = (processed: number, total: number) => Promise<boolean>;

export interface JobApplyContext {
  /**
   * Completes this attempt: `COMPLETED`, the stored input cleared. The handler
   * calls it with the transactional job repository inside the same
   * `UnitOfWork` that writes the rows (ADR-008 point 5). It resolves false
   * when the job is no longer the one being applied; the handler must then
   * throw `JobSupersededError` so the unit of work rolls back.
   */
  complete: (jobs: Pick<JobRepository, "transition">) => Promise<boolean>;
}

/**
 * The work of one job type, in the two stages of ADR-008 point 2.
 *
 * `validate` writes nothing. `apply` writes everything in one unit of work and
 * completes the job in it; it throws `JobApplyRejectedError` when a business
 * rule rejects the apply, `JobPortfolioArchivedError` when the portfolio was
 * archived, and anything else is a technical failure.
 */
export interface JobHandler {
  validate: (job: Job, report: JobProgressReporter) => Promise<JobValidationResult>;
  apply: (job: Job, context: JobApplyContext) => Promise<void>;
}

/** A business rule rejected the apply (ends `FAILED` with `APPLY_REJECTED`, retryable). */
export class JobApplyRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobApplyRejectedError";
  }
}

/** The portfolio was archived before the apply committed (ends `FAILED` with `PORTFOLIO_ARCHIVED`). */
export class JobPortfolioArchivedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobPortfolioArchivedError";
  }
}

/** The job moved on while it was being applied; the apply was rolled back. */
export class JobSupersededError extends Error {
  constructor(message = "The job is no longer being applied.") {
    super(message);
    this.name = "JobSupersededError";
  }
}

export interface JobRunnerDependencies {
  jobRepository: Pick<JobRepository, "listByStatuses" | "transition">;
  handlers: Readonly<Record<JobType, JobHandler>>;
  clock: Clock;
  pollIntervalMs?: number;
}

/**
 * In-process job runner.
 * Source: ADR-008 points 2-7 and Deferred detail (racing transitions, timeout
 * per attempt).
 *
 * It runs one job at a time. Every change of a job is a compare-and-set on
 * status, stage and attempt, so a job is claimed once, a cancel or a timeout
 * that wins the race stops the run, and nothing overwrites a committed apply.
 * The timeout covers the `QUEUED` wait and the validation, never the apply:
 * its timer's transition expects the validating stage, so it cannot match once
 * the job is applying.
 */
export function createJobRunner(dependencies: JobRunnerDependencies) {
  const {
    jobRepository,
    handlers,
    clock,
    pollIntervalMs = DEFAULT_JOB_POLL_INTERVAL_MS,
  } = dependencies;

  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = true;
  let pumping: Promise<void> | null = null;
  let pumpAgain = false;

  // Read through functions: both flags change from other calls while a pass awaits.
  const isStopped = (): boolean => stopped;
  const isPumpRequested = (): boolean => pumpAgain;

  const expectationOf = (job: Job): JobExpectation => ({
    status: job.status,
    stage: job.stage,
    attempt: job.attempt,
  });

  /** Moves a job `QUEUED` past its deadline to `TIMED_OUT`. */
  async function timeOutQueued(job: Job): Promise<void> {
    const now = clock.now();

    await jobRepository.transition({
      id: job.id,
      expected: expectationOf(job),
      patch: { status: JobStatus.TIMED_OUT, finishedAt: now },
      updatedAt: now,
    });
  }

  /** Times out every queued job whose deadline passed; safe to run alongside a job. */
  async function sweepExpired(): Promise<void> {
    const queued = await jobRepository.listByStatuses([JobStatus.QUEUED]);
    const now = clock.now();

    for (const job of queued) {
      if (now.getTime() >= job.deadlineAt.getTime()) {
        await timeOutQueued(job);
      }
    }
  }

  /** Claims the job for this run, or resolves null when something else got there first. */
  function claim(job: Job): Promise<Job | null> {
    const now = clock.now();

    return jobRepository.transition({
      id: job.id,
      expected: expectationOf(job),
      patch: { status: JobStatus.PROCESSING, stage: JobStage.VALIDATING },
      updatedAt: now,
    });
  }

  async function fail(
    job: Job,
    reason: JobFailureReason,
    extra: { report?: readonly JobRowError[]; total?: number; clearInput?: boolean } = {},
  ): Promise<void> {
    const now = clock.now();

    await jobRepository.transition({
      id: job.id,
      expected: expectationOf(job),
      patch: {
        status: JobStatus.FAILED,
        failureReason: reason,
        finishedAt: now,
        ...(extra.report ? { report: extra.report } : {}),
        ...(extra.total === undefined ? {} : { total: extra.total }),
        ...(extra.clearInput ? { input: null } : {}),
      },
      updatedAt: now,
    });
  }

  /** Applies a claimed job: the second stage, one unit of work that also completes it. */
  async function apply(job: Job, handler: JobHandler): Promise<void> {
    const context: JobApplyContext = {
      async complete(jobs) {
        const now = clock.now();
        const completed = await jobs.transition({
          id: job.id,
          expected: expectationOf(job),
          patch: { status: JobStatus.COMPLETED, input: null, finishedAt: now },
          updatedAt: now,
        });

        return completed !== null;
      },
    };

    try {
      await handler.apply(job, context);
    } catch (error) {
      if (error instanceof JobSupersededError) {
        return;
      }

      if (error instanceof JobPortfolioArchivedError) {
        await fail(job, JobFailureReason.PORTFOLIO_ARCHIVED, { clearInput: true });
      } else if (error instanceof JobApplyRejectedError) {
        await fail(job, JobFailureReason.APPLY_REJECTED);
      } else {
        await fail(job, JobFailureReason.APPLY_ERROR);
      }
    }
  }

  /** Runs a claimed job through both stages. */
  async function run(claimed: Job): Promise<void> {
    const handler = handlers[claimed.type];
    const validating = expectationOf(claimed);

    // The timeout is per attempt: it counts from `queuedAt`, so `deadlineAt` is
    // already fixed. The transition expects the validating stage, so it can no
    // longer match once the apply starts.
    const deadlineTimer = setTimeout(
      () => {
        const now = clock.now();

        jobRepository
          .transition({
            id: claimed.id,
            expected: validating,
            patch: { status: JobStatus.TIMED_OUT, finishedAt: now },
            updatedAt: now,
          })
          .catch(ignore);
      },
      Math.max(0, claimed.deadlineAt.getTime() - clock.now().getTime()),
    );

    try {
      const report: JobProgressReporter = async (processed, total) => {
        const updated = await jobRepository.transition({
          id: claimed.id,
          expected: validating,
          patch: { processed, total },
          updatedAt: clock.now(),
        });

        return updated !== null;
      };

      let result: JobValidationResult;

      try {
        result = await handler.validate(claimed, report);
      } catch {
        await fail(claimed, JobFailureReason.INTERRUPTED);
        return;
      }

      if (result.errors.length > 0) {
        await fail(claimed, JobFailureReason.VALIDATION_FAILED, {
          report: result.errors,
          total: result.total,
          clearInput: true,
        });
        return;
      }

      const now = clock.now();
      const applying = await jobRepository.transition({
        id: claimed.id,
        expected: validating,
        patch: { stage: JobStage.APPLYING, processed: result.total, total: result.total },
        updatedAt: now,
      });

      // Cancelled or timed out while validating: it lost the race, so stop.
      if (!applying) {
        return;
      }

      clearTimeout(deadlineTimer);
      await apply(applying, handler);
    } finally {
      clearTimeout(deadlineTimer);
    }
  }

  /** Runs queued jobs one after another until none can be claimed. */
  async function drain(): Promise<void> {
    while (!isStopped()) {
      const queued = await jobRepository.listByStatuses([JobStatus.QUEUED]);
      const now = clock.now();
      let claimed: Job | null = null;

      if (isStopped()) {
        return;
      }

      for (const job of queued) {
        if (now.getTime() >= job.deadlineAt.getTime()) {
          await timeOutQueued(job);
          continue;
        }

        claimed = await claim(job);

        if (claimed) {
          break;
        }
      }

      if (!claimed) {
        return;
      }

      await run(claimed);
    }
  }

  /** Looks for work now; calls made while a pass is running schedule one more pass. */
  function pump(): Promise<void> {
    if (pumping) {
      pumpAgain = true;
      return pumping;
    }

    pumping = (async () => {
      do {
        pumpAgain = false;
        await drain();
      } while (isPumpRequested() && !isStopped());
    })().finally(() => {
      pumping = null;
    });

    return pumping;
  }

  /** Starts polling and runs whatever is queued right away. */
  function start(): void {
    if (!stopped) {
      return;
    }

    stopped = false;
    timer = setInterval(() => {
      sweepExpired().catch(ignore);
      pump().catch(ignore);
    }, pollIntervalMs);
    pump().catch(ignore);
  }

  /** Stops taking jobs and waits for the one in flight to settle. */
  async function stop(): Promise<void> {
    stopped = true;

    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    await pumping;
  }

  /** A job was queued: run it without waiting for the next poll. */
  function notifyQueued(): void {
    if (!stopped) {
      pump().catch(ignore);
    }
  }

  return { start, stop, notifyQueued };
}

export type JobRunner = ReturnType<typeof createJobRunner>;
