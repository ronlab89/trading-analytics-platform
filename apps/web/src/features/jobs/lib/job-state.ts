import type { JobResponse } from "@trading/contracts";

type JobState = Pick<JobResponse, "status" | "stage" | "failureReason">;

/** Whether a job reached an end state: nothing more will happen to it unless it is retried. */
export function isJobFinished(job: Pick<JobResponse, "status">): boolean {
  return job.status !== "QUEUED" && job.status !== "PROCESSING";
}

/**
 * Whether the API still takes a cancel: while the job waits, or is validating. Once it applies its
 * rows it cannot stop (the API answers 409), so the button is not offered.
 */
export function canCancelJob(job: Pick<JobState, "status" | "stage">): boolean {
  return job.status === "QUEUED" || (job.status === "PROCESSING" && job.stage === "VALIDATING");
}

/**
 * Whether the API takes a retry: a job that timed out or was cancelled, or failed for a reason
 * that is not in the file or the portfolio (`INTERRUPTED`, `APPLY_ERROR`, `APPLY_REJECTED`). A
 * file that failed validation, or a portfolio that was archived, fails again the same way.
 */
export function canRetryJob(job: Pick<JobState, "status" | "failureReason">): boolean {
  if (job.status === "TIMED_OUT" || job.status === "CANCELLED") return true;
  return (
    job.status === "FAILED" &&
    (job.failureReason === "INTERRUPTED" ||
      job.failureReason === "APPLY_ERROR" ||
      job.failureReason === "APPLY_REJECTED")
  );
}

export type JobPhase =
  "QUEUED" | "VALIDATING" | "APPLYING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";

/**
 * What the user is told the job is doing: a job that is running is named by its stage (validating
 * the file, applying its rows), any other by its status.
 */
export function jobPhase(job: Pick<JobResponse, "status" | "stage">): JobPhase {
  if (job.status === "PROCESSING") return job.stage === "APPLYING" ? "APPLYING" : "VALIDATING";
  return job.status;
}
