/**
 * Job entity: one run of a background task, today the CSV transaction import.
 * Source: ADR-008 points 2-7, docs/BACKEND-ROADMAP.md B4.
 *
 * `status` is the lifecycle; progress (`processed`, `total`) is a field, not a
 * state. `stage` is persisted so a racing resume or cancel can be told apart
 * from the stage it expects, and `attempt` grows with every retry. The input
 * (the CSV content) lives in the row so a restart or a retry never depends on
 * the original request; it is cleared once no retry can need it. `queuedAt`
 * and `deadlineAt` are per attempt: a retry queues the job again with a fresh
 * deadline, so it cannot time out the moment it is retried.
 *
 * Pure domain type: no clock and no I/O. The caller supplies every date.
 */
export const JobType = {
  CSV_IMPORT: "CSV_IMPORT",
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  TIMED_OUT: "TIMED_OUT",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/** Where a job is inside its attempt. A finished job keeps the stage it ended in. */
export const JobStage = {
  QUEUED: "QUEUED",
  VALIDATING: "VALIDATING",
  APPLYING: "APPLYING",
} as const;

export type JobStage = (typeof JobStage)[keyof typeof JobStage];

/** The complete set of failure reasons (ADR-008 point 6). */
export const JobFailureReason = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INTERRUPTED: "INTERRUPTED",
  APPLY_ERROR: "APPLY_ERROR",
  APPLY_REJECTED: "APPLY_REJECTED",
  PORTFOLIO_ARCHIVED: "PORTFOLIO_ARCHIVED",
} as const;

export type JobFailureReason = (typeof JobFailureReason)[keyof typeof JobFailureReason];

/** One row of a validation report. `row` is the 1-based CSV row. */
export interface JobRowError {
  readonly row: number;
  readonly message: string;
}

export interface Job {
  readonly id: string;
  readonly userId: string;
  readonly portfolioId: string;
  readonly type: JobType;
  readonly status: JobStatus;
  readonly stage: JobStage;
  readonly attempt: number;
  readonly processed: number;
  readonly total: number;
  readonly failureReason: JobFailureReason | null;
  readonly report: readonly JobRowError[] | null;
  readonly input: string | null;
  readonly queuedAt: Date;
  readonly deadlineAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly finishedAt: Date | null;
}

/**
 * The repository assigns `id`, `createdAt` and `updatedAt`; a new job is
 * `QUEUED` in its first attempt with no progress, failure or report.
 */
export type CreateJobInput = Pick<
  Job,
  "userId" | "portfolioId" | "type" | "input" | "queuedAt" | "deadlineAt"
>;

/** What a transition expects the job to be, all compared in one step. */
export interface JobExpectation {
  readonly status: JobStatus;
  readonly stage: JobStage;
  readonly attempt: number;
}

/** The fields a transition may change; anything left out stays as it is. */
export interface JobPatch {
  readonly status?: JobStatus;
  readonly stage?: JobStage;
  readonly attempt?: number;
  readonly processed?: number;
  readonly total?: number;
  readonly failureReason?: JobFailureReason | null;
  readonly report?: readonly JobRowError[] | null;
  readonly input?: string | null;
  readonly queuedAt?: Date;
  readonly deadlineAt?: Date;
  readonly finishedAt?: Date | null;
}

export interface TransitionJobInput {
  readonly id: string;
  readonly expected: JobExpectation;
  readonly patch: JobPatch;
  readonly updatedAt: Date;
}

export class InvalidJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidJobError";
  }
}

const ALLOWED_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  QUEUED: ["PROCESSING", "CANCELLED", "TIMED_OUT"],
  PROCESSING: ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"],
  COMPLETED: [],
  FAILED: ["QUEUED"],
  CANCELLED: ["QUEUED"],
  TIMED_OUT: ["QUEUED"],
};

const RETRYABLE_FAILURES: readonly JobFailureReason[] = [
  JobFailureReason.INTERRUPTED,
  JobFailureReason.APPLY_ERROR,
  JobFailureReason.APPLY_REJECTED,
];

/** Status-level rule only; whether the stage allows it is `canCancelJob`. */
export function isJobTransitionAllowed(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Retry is allowed for `TIMED_OUT`, `CANCELLED` and the retryable failures (ADR-008 point 6). */
export function canRetryJob(job: Pick<Job, "status" | "failureReason">): boolean {
  if (job.status === JobStatus.TIMED_OUT || job.status === JobStatus.CANCELLED) {
    return true;
  }

  return (
    job.status === JobStatus.FAILED &&
    job.failureReason !== null &&
    RETRYABLE_FAILURES.includes(job.failureReason)
  );
}

/** Cancel is allowed while `QUEUED` or validating, never while applying (ADR-008 point 6). */
export function canCancelJob(job: Pick<Job, "status" | "stage">): boolean {
  return (
    job.status === JobStatus.QUEUED ||
    (job.status === JobStatus.PROCESSING && job.stage === JobStage.VALIDATING)
  );
}

/** The timeout applies while `QUEUED` or validating, never during apply (ADR-008 point 7). */
export function isJobTimeoutApplicable(job: Pick<Job, "status" | "stage">): boolean {
  return canCancelJob(job);
}

/** Domain invariants for Job creation. */
export function validateNewJob(input: CreateJobInput): void {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new InvalidJobError("A userId is required.");
  }

  if (!input.portfolioId || input.portfolioId.trim().length === 0) {
    throw new InvalidJobError("A portfolioId is required.");
  }

  if (input.input === null || input.input.length === 0) {
    throw new InvalidJobError("The job input is required.");
  }

  if (Number.isNaN(input.queuedAt.getTime()) || Number.isNaN(input.deadlineAt.getTime())) {
    throw new InvalidJobError("queuedAt and deadlineAt must be valid dates.");
  }

  if (input.deadlineAt.getTime() <= input.queuedAt.getTime()) {
    throw new InvalidJobError("deadlineAt must be after queuedAt.");
  }
}
