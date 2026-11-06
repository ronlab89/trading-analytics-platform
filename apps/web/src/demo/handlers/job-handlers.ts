import { presentJob } from "@trading/contracts";
import { ApiError } from "@/api/trading-client";
import type { HandlerContext, HandlerRegistry } from "./handler";

interface JobParams {
  readonly jobId: string;
}

/** Mirrors `jobs.controller.ts` of the API: a 202 answer, and the runner picks the job up at once. */
export function createJobHandlers({ composition }: HandlerContext): HandlerRegistry {
  const { jobService, jobRunner, actor } = composition;

  return {
    importTransactions: async ({ params, body }) => {
      const { portfolioId } = params as { portfolioId: string };
      if (typeof body !== "string" || body.trim() === "") {
        throw new ApiError(
          "VALIDATION_ERROR",
          "The request body must be a non-empty CSV file sent as text/csv.",
          400,
        );
      }
      const job = await jobService.createJob(actor, portfolioId, {
        type: "CSV_IMPORT",
        input: body,
      });
      jobRunner.notifyQueued();
      return { data: presentJob(job) };
    },
    getJob: async ({ params }) => {
      const { jobId } = params as JobParams;
      return { data: presentJob(await jobService.getJobById(actor, jobId)) };
    },
    retryJob: async ({ params }) => {
      const { jobId } = params as JobParams;
      const job = await jobService.retryJob(actor, jobId);
      jobRunner.notifyQueued();
      return { data: presentJob(job) };
    },
    cancelJob: async ({ params }) => {
      const { jobId } = params as JobParams;
      return { data: presentJob(await jobService.cancelJob(actor, jobId)) };
    },
  };
}
