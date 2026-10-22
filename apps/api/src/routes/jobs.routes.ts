import express, { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { idempotency } from "../middleware/idempotency.js";
import { validate } from "../middleware/validate.js";
import { jobIdParamsSchema, portfolioIdParamsSchema } from "@trading/contracts";
import { IMPORT_MAX_BYTES } from "@trading/application";
import { makeJobsController, requireCsvBody } from "../controllers/jobs.controller.js";
import { composition } from "../composition.js";

const { createImportHandler, getJobHandler, retryJobHandler, cancelJobHandler } =
  makeJobsController(composition.jobService, composition.jobRunner, composition.idempotencyService);

export const jobsRouter: ExpressRouter = Router();

jobsRouter.post(
  "/api/v1/portfolios/:portfolioId/imports",
  authenticate,
  validate(portfolioIdParamsSchema, "params"),
  // The CSV travels as the raw `text/csv` body (ADR-008 point 3), up to its own limit.
  express.text({ type: "text/csv", limit: IMPORT_MAX_BYTES }),
  requireCsvBody,
  idempotency(composition.idempotencyService),
  createImportHandler,
);

jobsRouter.get(
  "/api/v1/jobs/:jobId",
  authenticate,
  validate(jobIdParamsSchema, "params"),
  getJobHandler,
);

jobsRouter.post(
  "/api/v1/jobs/:jobId/retry",
  authenticate,
  validate(jobIdParamsSchema, "params"),
  retryJobHandler,
);

jobsRouter.post(
  "/api/v1/jobs/:jobId/cancel",
  authenticate,
  validate(jobIdParamsSchema, "params"),
  cancelJobHandler,
);
