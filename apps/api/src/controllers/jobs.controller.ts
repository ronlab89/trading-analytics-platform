import type { NextFunction, Request, Response } from "express";
import { presentJob } from "@trading/contracts";
import type { IdempotencyService, JobRunner, JobService } from "@trading/application";
import { AppError } from "../errors/app-error.js";
import { actorOf } from "../middleware/authenticate.js";
import { idempotencyOf } from "../middleware/idempotency.js";

/**
 * Rejects an import whose body is not a non-empty `text/csv` file. It runs
 * before the `Idempotency-Key` middleware, so a request that was never a valid
 * import does not reserve the key.
 */
export function requireCsvBody(req: Request, _res: Response, next: NextFunction): void {
  const body = req.body as unknown;

  if (typeof body !== "string" || body.trim() === "") {
    next(
      new AppError(
        "VALIDATION_ERROR",
        "The request body must be a non-empty CSV file sent as text/csv.",
        400,
      ),
    );
    return;
  }

  next();
}

/** Job and import HTTP handlers, bound to the use cases they call. */
export function makeJobsController(
  jobService: JobService,
  jobRunner: Pick<JobRunner, "notifyQueued">,
  idempotencyService: Pick<IdempotencyService, "complete">,
) {
  /**
   * POST /api/v1/portfolios/:portfolioId/imports
   * Source: ADR-008 points 2-4 and 8.
   *
   * Queues the import and answers 202 with the job to poll. The body is the
   * CSV text, already read by `express.text` on the route.
   */
  async function createImportHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const idempotent = idempotencyOf(res);

    try {
      const job = await jobService.createJob(
        actorOf(req),
        req.params.portfolioId as string,
        { type: "CSV_IMPORT", input: req.body as string },
        // With an `Idempotency-Key`, the response is stored in the same unit of
        // work as the job, so the key and the job commit together.
        idempotent
          ? async (created, repositories) => {
              await idempotencyService.complete(
                {
                  ...idempotent,
                  responseStatus: 202,
                  responseBody: { data: presentJob(created) },
                },
                repositories.idempotencyKeys,
              );
            }
          : undefined,
      );
      jobRunner.notifyQueued();
      res
        .status(202)
        .location(`/api/v1/jobs/${job.id}`)
        .json({ data: presentJob(job) });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/jobs/:jobId */
  async function getJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.getJobById(actorOf(req), req.params.jobId as string);
      res.status(200).json({ data: presentJob(job) });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/jobs/:jobId/retry: queues a failed, timed-out or cancelled job again. */
  async function retryJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.retryJob(actorOf(req), req.params.jobId as string);
      jobRunner.notifyQueued();
      res
        .status(202)
        .location(`/api/v1/jobs/${job.id}`)
        .json({ data: presentJob(job) });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/jobs/:jobId/cancel */
  async function cancelJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.cancelJob(actorOf(req), req.params.jobId as string);
      res.status(200).json({ data: presentJob(job) });
    } catch (error) {
      next(error);
    }
  }

  return { createImportHandler, getJobHandler, retryJobHandler, cancelJobHandler };
}
