import { z } from "zod";
import { JobFailureReason, JobStage, JobStatus, JobType } from "@trading/domain";
import type { Job } from "@trading/domain";
import { isoTimestampSchema, presentTimestamp } from "./response-common.schema.js";

const typeValues = Object.values(JobType) as [JobType, ...JobType[]];
const statusValues = Object.values(JobStatus) as [JobStatus, ...JobStatus[]];
const stageValues = Object.values(JobStage) as [JobStage, ...JobStage[]];
const failureReasonValues = Object.values(JobFailureReason) as [
  JobFailureReason,
  ...JobFailureReason[],
];

/**
 * Response shape for the job endpoints.
 * Source: ADR-008 points 2-7, 07-api-spec.md (Jobs).
 *
 * The CSV `input` stays in the row for retries and is never part of the
 * contract: a job is read by its owner, but the content of their file is not
 * echoed back.
 */
export const jobResponseSchema = z.object({
  id: z.string(),
  portfolioId: z.string(),
  type: z.enum(typeValues),
  status: z.enum(statusValues),
  stage: z.enum(stageValues),
  attempt: z.number().int().min(1),
  progress: z.object({
    processed: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
  failureReason: z.enum(failureReasonValues).nullable(),
  report: z.array(z.object({ row: z.number().int().min(0), message: z.string() })).nullable(),
  queuedAt: isoTimestampSchema,
  deadlineAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  finishedAt: isoTimestampSchema.nullable(),
});
export type JobResponse = z.infer<typeof jobResponseSchema>;

export function presentJob(job: Job): JobResponse {
  return {
    id: job.id,
    portfolioId: job.portfolioId,
    type: job.type,
    status: job.status,
    stage: job.stage,
    attempt: job.attempt,
    progress: { processed: job.processed, total: job.total },
    failureReason: job.failureReason,
    report: job.report ? job.report.map(({ row, message }) => ({ row, message })) : null,
    queuedAt: presentTimestamp(job.queuedAt),
    deadlineAt: presentTimestamp(job.deadlineAt),
    createdAt: presentTimestamp(job.createdAt),
    updatedAt: presentTimestamp(job.updatedAt),
    finishedAt: job.finishedAt ? presentTimestamp(job.finishedAt) : null,
  };
}
