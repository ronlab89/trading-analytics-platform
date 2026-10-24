import { z } from "zod";
import type { ApiOperation } from "../api-operation.js";
import { jobResponseSchema } from "../job.response.js";
import {
  jobIdParamsSchema,
  portfolioIdParamsSchema,
  portfolioTransactionParamsSchema,
} from "../params.schema.js";
import { dataEnvelope, pageEnvelope } from "../response-common.schema.js";
import {
  createTransactionResponseSchema,
  transactionResponseSchema,
} from "../transaction.response.js";
import {
  createTransactionRequestSchema,
  listTransactionsQuerySchema,
} from "../transaction.schema.js";
import { idempotencyKeyHeaderSchema } from "./shared.js";

const REPLAYED =
  "`true` when the answer is the stored one of an earlier request with the same `Idempotency-Key`.";
const JOB_LOCATION = "Where to follow the job: `/api/v1/jobs/{jobId}`.";

/** Transactions, the CSV import and its jobs (07-api-spec.md §13-§14, ADR-008). */
export const transactionOperations: readonly ApiOperation[] = [
  {
    operationId: "listTransactions",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/transactions",
    tag: "Transactions",
    summary: "List the transactions of a portfolio",
    authenticated: true,
    params: portfolioIdParamsSchema,
    query: listTransactionsQuerySchema,
    success: {
      status: 200,
      description: "A page of transactions.",
      schema: pageEnvelope(transactionResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getTransaction",
    method: "get",
    path: "/api/v1/portfolios/:portfolioId/transactions/:transactionId",
    tag: "Transactions",
    summary: "Get a transaction",
    authenticated: true,
    params: portfolioTransactionParamsSchema,
    success: {
      status: 200,
      description: "The transaction.",
      schema: dataEnvelope(transactionResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "createTransaction",
    method: "post",
    path: "/api/v1/portfolios/:portfolioId/transactions",
    tag: "Transactions",
    summary: "Record a transaction",
    description:
      "Validates the transaction, stores it and recalculates the position in one unit of work. An archived portfolio cannot be modified. Send an `Idempotency-Key` to make a retry safe: the same key with the same request returns the stored answer, and the same key with a different request is a conflict.",
    authenticated: true,
    params: portfolioIdParamsSchema,
    headers: idempotencyKeyHeaderSchema,
    body: createTransactionRequestSchema,
    success: {
      status: 201,
      description: "The transaction and the position it changed.",
      headers: { "Idempotency-Replayed": REPLAYED },
      schema: dataEnvelope(createTransactionResponseSchema),
    },
    errors: [400, 401, 403, 404, 409, 429],
  },
  {
    operationId: "importTransactions",
    method: "post",
    path: "/api/v1/portfolios/:portfolioId/imports",
    tag: "Jobs",
    summary: "Import transactions from a CSV file",
    description:
      "The CSV travels as the raw `text/csv` body, up to 1 MB and 5000 data rows. The import runs as a background job: follow it with `GET /api/v1/jobs/{jobId}`. Send an `Idempotency-Key` to make a retry safe.",
    authenticated: true,
    params: portfolioIdParamsSchema,
    headers: idempotencyKeyHeaderSchema,
    body: z.string(),
    bodyContentType: "text/csv",
    success: {
      status: 202,
      description: "The job that was queued.",
      headers: { Location: JOB_LOCATION, "Idempotency-Replayed": REPLAYED },
      schema: dataEnvelope(jobResponseSchema),
    },
    errors: [400, 401, 403, 404, 409, 413, 429],
  },
  {
    operationId: "getJob",
    method: "get",
    path: "/api/v1/jobs/:jobId",
    tag: "Jobs",
    summary: "Get a job",
    authenticated: true,
    params: jobIdParamsSchema,
    success: {
      status: 200,
      description: "The job.",
      schema: dataEnvelope(jobResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "retryJob",
    method: "post",
    path: "/api/v1/jobs/:jobId/retry",
    tag: "Jobs",
    summary: "Queue a failed, timed-out or cancelled job again",
    description: "A job in any other state cannot be retried.",
    authenticated: true,
    params: jobIdParamsSchema,
    success: {
      status: 202,
      description: "The job, queued again.",
      headers: { Location: JOB_LOCATION },
      schema: dataEnvelope(jobResponseSchema),
    },
    errors: [400, 401, 403, 404, 409, 429],
  },
  {
    operationId: "cancelJob",
    method: "post",
    path: "/api/v1/jobs/:jobId/cancel",
    tag: "Jobs",
    summary: "Cancel a job",
    description:
      "A job that already finished, or is applying its rows, can no longer be cancelled.",
    authenticated: true,
    params: jobIdParamsSchema,
    success: {
      status: 200,
      description: "The job after the cancel.",
      schema: dataEnvelope(jobResponseSchema),
    },
    errors: [400, 401, 403, 404, 409, 429],
  },
];
