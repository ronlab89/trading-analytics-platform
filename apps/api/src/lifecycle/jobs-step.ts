import type { JobRunner } from "@trading/application";
import type { ShutdownStep } from "./shutdown.js";

/**
 * The shutdown step of the job runner (ADR-006 point 12, ADR-008 point 5).
 *
 * Register it before the HTTP step: the runner stops taking jobs first, gives
 * the job in flight its grace period, and marks it interrupted if that runs
 * out, so no job is left `PROCESSING` silently.
 */
export function createJobsShutdownStep(runner: Pick<JobRunner, "stop">): ShutdownStep {
  return { name: "jobs", run: () => runner.stop() };
}
