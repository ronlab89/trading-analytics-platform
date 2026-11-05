import type { JobResponse } from "@trading/contracts";

/** Whether a job reached an end state: nothing more will happen to it unless it is retried. */
export function isJobFinished(job: Pick<JobResponse, "status">): boolean {
  return job.status !== "QUEUED" && job.status !== "PROCESSING";
}
