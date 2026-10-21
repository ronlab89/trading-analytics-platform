import { JobStage, JobStatus, canCancelJob, canRetryJob, validateNewJob } from "@trading/domain";
import type {
  Job,
  JobRepository,
  JobType,
  TransactionalRepositories,
  UnitOfWork,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import type { Clock } from "./clock.js";
import { ConflictError, NotFoundError } from "./errors.js";
import { JOB_EVENTS, jobLogFields } from "./job-events.js";
import { silentLogger } from "./logger.js";
import type { Logger } from "./logger.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import { assertPortfolioWritable } from "./portfolio-guard.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";

/** Five minutes per attempt (ADR-008 point 7, decided in the B4 plan). */
export const DEFAULT_JOB_TIMEOUT_MS = 5 * 60 * 1000;

export interface JobServiceDependencies {
  jobRepository: Pick<JobRepository, "create" | "getById" | "transition">;
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  /** Needed only to create a job together with something else (`withinUnit`). */
  unitOfWork?: UnitOfWork;
  /** Source of "now" for `queuedAt`, `deadlineAt` and `finishedAt` (ADR-001 point 8). */
  clock: Clock;
  /** Writes the job lifecycle events; defaults to a logger that drops them. */
  logger?: Logger;
  /** Timeout per attempt for each job type, in milliseconds. */
  timeoutMs?: Readonly<Record<JobType, number>>;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

export interface CreateJobRequest {
  type: JobType;
  /** The content the job will process, stored in the row (ADR-008 point 4). */
  input: string;
}

/**
 * Job use cases: create, read, cancel and retry.
 * Source: ADR-008 points 4, 6, 7 and 9, and the Deferred detail rows on
 * permissions and racing transitions.
 *
 * Ownership is checked on the job itself (a job of another user reads as
 * missing). A cancel or retry the state does not allow is a `ConflictError`
 * and changes nothing; so is one that lost a race, because the transition is a
 * compare-and-set that matched no row.
 */
export function createJobService(dependencies: JobServiceDependencies) {
  const {
    jobRepository,
    portfolioService,
    clock,
    unitOfWork,
    logger = silentLogger,
    timeoutMs = { CSV_IMPORT: DEFAULT_JOB_TIMEOUT_MS },
    permissions = ROLE_PERMISSIONS,
  } = dependencies;

  /** Returns the job when it belongs to the actor, otherwise a not-found. */
  async function getOwnedJob(actor: Actor, jobId: string): Promise<Job> {
    const job = await jobRepository.getById(jobId);

    if (job?.userId === actor.userId) {
      return job;
    }

    throw new NotFoundError("The requested job could not be found.");
  }

  /**
   * Queues a job on an owned, writable portfolio. Its deadline is the timeout
   * of its type counted from now.
   *
   * `withinUnit`, when given, runs inside the same unit of work that creates
   * the job, so something that must commit with it (the stored response of an
   * `Idempotency-Key`) does, or rolls back with it. It needs a `unitOfWork`.
   */
  async function createJob(
    actor: Actor,
    portfolioId: string,
    request: CreateJobRequest,
    withinUnit?: (job: Job, repositories: TransactionalRepositories) => Promise<void>,
  ): Promise<Job> {
    assertPermission(actor, "transaction:create", permissions);
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);
    assertPortfolioWritable(portfolio);

    const queuedAt = clock.now();
    const input = {
      userId: actor.userId,
      portfolioId,
      type: request.type,
      input: request.input,
      queuedAt,
      deadlineAt: new Date(queuedAt.getTime() + timeoutMs[request.type]),
    };

    validateNewJob(input);

    let created: Job;

    if (withinUnit) {
      if (!unitOfWork) {
        throw new Error("createJob needs a unitOfWork to run withinUnit.");
      }

      created = await unitOfWork.run(async (repositories) => {
        const job = await repositories.jobs.create(input);
        await withinUnit(job, repositories);

        return job;
      });
    } else {
      created = await jobRepository.create(input);
    }

    logger.info(JOB_EVENTS.queued, jobLogFields(created));

    return created;
  }

  /** Returns one job of the actor. */
  async function getJobById(actor: Actor, jobId: string): Promise<Job> {
    assertPermission(actor, "transaction:read", permissions);

    return getOwnedJob(actor, jobId);
  }

  /** Cancels a job that is `QUEUED` or validating (ADR-008 point 6). */
  async function cancelJob(actor: Actor, jobId: string): Promise<Job> {
    assertPermission(actor, "transaction:create", permissions);
    const job = await getOwnedJob(actor, jobId);

    if (!canCancelJob(job)) {
      throw new ConflictError("The job can no longer be cancelled.");
    }

    const now = clock.now();
    const cancelled = await jobRepository.transition({
      id: job.id,
      expected: { status: job.status, stage: job.stage, attempt: job.attempt },
      patch: { status: JobStatus.CANCELLED, finishedAt: now },
      updatedAt: now,
    });

    if (!cancelled) {
      throw new ConflictError("The job can no longer be cancelled.");
    }

    logger.info(JOB_EVENTS.cancelled, jobLogFields(cancelled, { stage: job.stage }));

    return cancelled;
  }

  /**
   * Returns a retryable job to `QUEUED` as a new attempt with fresh progress
   * and a fresh deadline, so it cannot time out the moment it is retried.
   */
  async function retryJob(actor: Actor, jobId: string): Promise<Job> {
    assertPermission(actor, "transaction:create", permissions);
    const job = await getOwnedJob(actor, jobId);

    if (!canRetryJob(job) || job.input === null) {
      throw new ConflictError("The job cannot be retried.");
    }

    const now = clock.now();
    const queued = await jobRepository.transition({
      id: job.id,
      expected: { status: job.status, stage: job.stage, attempt: job.attempt },
      patch: {
        status: JobStatus.QUEUED,
        stage: JobStage.QUEUED,
        attempt: job.attempt + 1,
        processed: 0,
        total: 0,
        failureReason: null,
        report: null,
        queuedAt: now,
        deadlineAt: new Date(now.getTime() + timeoutMs[job.type]),
        finishedAt: null,
      },
      updatedAt: now,
    });

    if (!queued) {
      throw new ConflictError("The job cannot be retried.");
    }

    logger.info(JOB_EVENTS.queued, jobLogFields(queued));

    return queued;
  }

  return { createJob, getJobById, cancelJob, retryJob };
}

export type JobService = ReturnType<typeof createJobService>;
