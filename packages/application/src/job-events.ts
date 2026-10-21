import type { Job } from "@trading/domain";
import type { LogFields } from "./logger.js";

/**
 * Stable names of the job lifecycle events (ADR-009 points 5 and 11, ADR-008).
 *
 * `queued` is written when a job is created and again when a retry queues the
 * next attempt (`attempt` tells them apart), so there is no separate retry
 * name. Progress is a field, not a state, and is not logged.
 */
export const JOB_EVENTS = {
  queued: "job.queued",
  started: "job.started",
  completed: "job.completed",
  failed: "job.failed",
  cancelled: "job.cancelled",
  timedOut: "job.timed_out",
} as const;

/** The correlation field `jobId` (ADR-009 point 5) with the identifiers that locate the attempt. */
export function jobLogFields(job: Job, extra: LogFields = {}): LogFields {
  return {
    jobId: job.id,
    userId: job.userId,
    type: job.type,
    attempt: job.attempt,
    ...extra,
  };
}
