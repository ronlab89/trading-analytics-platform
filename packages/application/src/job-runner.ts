import { JobFailureReason, JobStage, JobStatus } from "@trading/domain";
import type { Job, JobExpectation, JobRepository, JobRowError, JobType } from "@trading/domain";
import type { Clock } from "./clock.js";
import { JOB_EVENTS, jobLogFields } from "./job-events.js";
import type { JobNotifier } from "./job-notifier.js";
import { silentLogger } from "./logger.js";
import type { Logger } from "./logger.js";
import { publishQuietly } from "./publish-quietly.js";
import type { RealtimePublisher } from "./realtime-publisher.js";

/** A background pass that fails is retried by the next poll; there is no caller to tell. */
const ignore = (): void => undefined;

/** How long a shutdown waits for the job in flight before it marks the job interrupted. */
export const DEFAULT_JOB_SHUTDOWN_GRACE_MS = 5000;

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
  /** Writes the job lifecycle events; defaults to a logger that drops them. */
  logger?: Logger;
  /** Tells the owner how a job ended; without one, nobody is notified. */
  notifier?: JobNotifier;
  /**
   * Publishes the job events after each change committed (ADR-007 point 15):
   * progress while validating, `COMPLETED` and `FAILED`. Without one, nothing
   * is published. A publish that fails is logged and never changes the job.
   */
  realtimePublisher?: Pick<RealtimePublisher, "jobProgressUpdated" | "jobCompleted" | "jobFailed">;
  pollIntervalMs?: number;
  shutdownGraceMs?: number;
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
    logger = silentLogger,
    notifier,
    realtimePublisher,
    pollIntervalMs = DEFAULT_JOB_POLL_INTERVAL_MS,
    shutdownGraceMs = DEFAULT_JOB_SHUTDOWN_GRACE_MS,
  } = dependencies;

  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = true;
  let pumping: Promise<void> | null = null;
  let pumpAgain = false;
  // The job this process is running right now, as the row last wrote it.
  let inFlight: Job | null = null;
  let recovered = false;
  let recovering: Promise<void> | null = null;

  // Read through functions: both flags change from other calls while a pass awaits.
  const isStopped = (): boolean => stopped;
  const isPumpRequested = (): boolean => pumpAgain;

  const expectationOf = (job: Job): JobExpectation => ({
    status: job.status,
    stage: job.stage,
    attempt: job.attempt,
  });

  /** Notifies the owner of a finished job. A notification that fails never fails the job. */
  async function announce(finished: Job): Promise<void> {
    try {
      await notifier?.jobFinished(finished);
    } catch {
      logger.warn(JOB_EVENTS.notificationFailed, jobLogFields(finished));
    }
  }

  /** Publishes a job event; `CANCELLED` and `TIMED_OUT` never reach here (ADR-007 point 15). */
  async function publish(
    event: string,
    job: Job,
    send: (publisher: NonNullable<typeof realtimePublisher>) => Promise<void>,
  ): Promise<void> {
    if (realtimePublisher) {
      await publishQuietly(logger, event, jobLogFields(job), () => send(realtimePublisher));
    }
  }

  /** Moves a job past its deadline, `QUEUED` or validating, to `TIMED_OUT`. */
  async function timeOut(job: Job): Promise<void> {
    const now = clock.now();

    const timedOut = await jobRepository.transition({
      id: job.id,
      expected: expectationOf(job),
      patch: { status: JobStatus.TIMED_OUT, finishedAt: now },
      updatedAt: now,
    });

    if (timedOut) {
      logger.warn(JOB_EVENTS.timedOut, jobLogFields(job, { stage: job.stage }));
      await announce(timedOut);
    }
  }

  /**
   * Startup recovery (ADR-008 point 5). A job left `PROCESSING` has written
   * nothing, because the apply completes it in the transaction that writes the
   * rows: it becomes `FAILED` with `INTERRUPTED`, retryable. `QUEUED` jobs need
   * nothing here: the first pass resumes them, and times out those past their
   * deadline.
   */
  async function recover(): Promise<void> {
    const processing = await jobRepository.listByStatuses([JobStatus.PROCESSING]);

    for (const job of processing) {
      await fail(job, JobFailureReason.INTERRUPTED);
    }
  }

  /** Runs the recovery before the first claim; a failed attempt is repeated by the next pass. */
  async function ensureRecovered(): Promise<void> {
    if (recovered) {
      return;
    }

    recovering ??= recover()
      .then(() => {
        recovered = true;
      })
      .finally(() => {
        recovering = null;
      });

    await recovering;
  }

  /** Times out every queued job whose deadline passed; safe to run alongside a job. */
  async function sweepExpired(): Promise<void> {
    await ensureRecovered();
    const queued = await jobRepository.listByStatuses([JobStatus.QUEUED]);
    const now = clock.now();

    for (const job of queued) {
      if (now.getTime() >= job.deadlineAt.getTime()) {
        await timeOut(job);
      }
    }
  }

  /** Claims the job for this run, or resolves null when something else got there first. */
  async function claim(job: Job): Promise<Job | null> {
    const claimed = await jobRepository.transition({
      id: job.id,
      expected: expectationOf(job),
      patch: { status: JobStatus.PROCESSING, stage: JobStage.VALIDATING },
      updatedAt: clock.now(),
    });

    if (claimed) {
      logger.info(JOB_EVENTS.started, jobLogFields(claimed));
    }

    return claimed;
  }

  async function fail(
    job: Job,
    reason: JobFailureReason,
    extra: { report?: readonly JobRowError[]; total?: number; clearInput?: boolean } = {},
  ): Promise<void> {
    const now = clock.now();

    const failed = await jobRepository.transition({
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

    if (failed) {
      logger.warn(JOB_EVENTS.failed, jobLogFields(job, { reason, stage: job.stage }));
      await publish("JOB_FAILED", failed, (publisher) => publisher.jobFailed(failed));
      await announce(failed);
    }
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
      logger.info(JOB_EVENTS.completed, jobLogFields(job));
      const completed = { ...job, status: JobStatus.COMPLETED, failureReason: null };
      await publish("JOB_COMPLETED", completed, (publisher) => publisher.jobCompleted(completed));
      await announce(completed);
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
    inFlight = claimed;

    // The timeout is per attempt: it counts from `queuedAt`, so `deadlineAt` is
    // already fixed. The transition expects the validating stage, so it can no
    // longer match once the apply starts.
    const deadlineTimer = setTimeout(
      () => {
        timeOut(claimed).catch(ignore);
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

        if (updated === null) {
          return false;
        }

        await publish("JOB_PROGRESS_UPDATED", updated, (publisher) =>
          publisher.jobProgressUpdated(updated),
        );
        return true;
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
      inFlight = applying;
      await apply(applying, handler);
    } finally {
      clearTimeout(deadlineTimer);
      inFlight = null;
    }
  }

  /** Runs queued jobs one after another until none can be claimed. */
  async function drain(): Promise<void> {
    while (!isStopped()) {
      await ensureRecovered();
      const queued = await jobRepository.listByStatuses([JobStatus.QUEUED]);
      const now = clock.now();
      let claimed: Job | null = null;

      if (isStopped()) {
        return;
      }

      for (const job of queued) {
        if (now.getTime() >= job.deadlineAt.getTime()) {
          await timeOut(job);
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

  /**
   * Stops taking jobs and gives the one in flight `shutdownGraceMs` to settle.
   * If it does not, the job is marked `FAILED` with `INTERRUPTED` (retryable),
   * so none is left `PROCESSING` silently. A still-running apply then finds its
   * conditional completion matching no row and rolls back (ADR-008 point 5).
   */
  async function stop(): Promise<void> {
    stopped = true;

    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    if (!pumping) {
      return;
    }

    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const grace = new Promise<"timeout">((resolve) => {
      graceTimer = setTimeout(() => {
        resolve("timeout");
      }, shutdownGraceMs);
    });
    const settled = pumping.then(
      () => "settled" as const,
      () => "settled" as const,
    );

    const outcome = await Promise.race([settled, grace]);
    clearTimeout(graceTimer);

    if (outcome === "timeout" && inFlight) {
      await fail(inFlight, JobFailureReason.INTERRUPTED);
    }
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
