import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { Express } from "express";
import request from "supertest";
import { ConflictError, NotFoundError } from "@trading/application";
import type { Job, TransactionalRepositories } from "@trading/domain";
import { errorHandler } from "../middleware/error-handler.js";
import { idempotency } from "../middleware/idempotency.js";
import { makeJobsController, requireCsvBody } from "./jobs.controller.js";

const noop = (): void => undefined;

const job: Job = {
  id: "j1",
  userId: "u1",
  portfolioId: "p1",
  type: "CSV_IMPORT",
  status: "QUEUED",
  stage: "QUEUED",
  attempt: 1,
  processed: 0,
  total: 0,
  failureReason: null,
  report: null,
  input: "symbol,type\nAAPL,BUY",
  queuedAt: new Date("2026-10-21T10:00:00.000Z"),
  deadlineAt: new Date("2026-10-21T10:05:00.000Z"),
  createdAt: new Date("2026-10-21T10:00:00.000Z"),
  updatedAt: new Date("2026-10-21T10:00:00.000Z"),
  finishedAt: null,
};

function build() {
  const createJob = vi.fn(
    (
      _actor: unknown,
      _portfolioId: string,
      _request: unknown,
      withinUnit?: (job: Job, repositories: TransactionalRepositories) => Promise<void>,
    ) =>
      (withinUnit
        ? withinUnit(job, { idempotencyKeys: {} } as TransactionalRepositories)
        : Promise.resolve()
      ).then(() => job),
  );
  const getJobById = vi.fn((_actor: unknown, _jobId: string) => Promise.resolve(job));
  const retryJob = vi.fn((_actor: unknown, _jobId: string) => Promise.resolve(job));
  const cancelJob = vi.fn((_actor: unknown, _jobId: string) =>
    Promise.resolve({ ...job, status: "CANCELLED" as const }),
  );
  const notifyQueued = vi.fn();
  const complete = vi.fn((_input: unknown, _repository?: unknown) => Promise.resolve(true));
  const begin = vi.fn((_request: unknown) => Promise.resolve({ kind: "proceed" as const }));
  const release = vi.fn(() => Promise.resolve());

  const { createImportHandler, getJobHandler, retryJobHandler, cancelJobHandler } =
    makeJobsController(
      { createJob, getJobById, retryJob, cancelJob },
      { notifyQueued },
      { complete },
    );

  const app: Express = express();
  app.use((req, _res, next) => {
    req.logger = { debug: noop, info: noop, warn: noop, error: noop };
    req.actor = { userId: "u1", role: "TRADER" };
    next();
  });
  app.post(
    "/portfolios/:portfolioId/imports",
    express.text({ type: "text/csv", limit: 1024 }),
    requireCsvBody,
    idempotency({ begin, complete, release }),
    createImportHandler,
  );
  app.get("/jobs/:jobId", getJobHandler);
  app.post("/jobs/:jobId/retry", retryJobHandler);
  app.post("/jobs/:jobId/cancel", cancelJobHandler);
  app.use(errorHandler);

  return { app, createJob, getJobById, retryJob, cancelJob, notifyQueued, complete, begin };
}

const CSV = "symbol,type,quantity,price,executedAt\nAAPL,BUY,1,100,2026-01-02T00:00:00Z";

describe("POST /portfolios/:portfolioId/imports", () => {
  it("queues the CSV text as a job and answers 202 with the job and where to poll it", async () => {
    const { app, createJob, notifyQueued } = build();

    const response = await request(app)
      .post("/portfolios/p1/imports")
      .set("Content-Type", "text/csv")
      .send(CSV);

    expect(response.status).toBe(202);
    expect(response.headers.location).toBe("/api/v1/jobs/j1");
    expect(response.body).toMatchObject({ data: { id: "j1", status: "QUEUED", attempt: 1 } });
    expect(response.body).not.toHaveProperty("data.input");
    expect(createJob).toHaveBeenCalledWith(
      { userId: "u1", role: "TRADER" },
      "p1",
      { type: "CSV_IMPORT", input: CSV },
      undefined,
    );
    expect(notifyQueued).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a JSON body", "application/json", JSON.stringify({ csv: CSV })],
    ["an empty text/csv body", "text/csv", ""],
    ["a blank text/csv body", "text/csv", "  \n "],
  ])("answers 400 VALIDATION_ERROR for %s without creating a job", async (_name, type, payload) => {
    const { app, createJob, notifyQueued } = build();

    const response = await request(app)
      .post("/portfolios/p1/imports")
      .set("Content-Type", type)
      .send(payload);

    expect(response.status).toBe(400);
    expect((response.body as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(createJob).not.toHaveBeenCalled();
    expect(notifyQueued).not.toHaveBeenCalled();
  });

  it("answers 413 for a file over the limit without creating a job", async () => {
    const { app, createJob } = build();

    const response = await request(app)
      .post("/portfolios/p1/imports")
      .set("Content-Type", "text/csv")
      .send("x".repeat(2048));

    expect(response.status).toBe(413);
    expect(createJob).not.toHaveBeenCalled();
  });

  it("does not reserve the key for a body that is not a valid import", async () => {
    const { app, begin } = build();

    await request(app)
      .post("/portfolios/p1/imports")
      .set("Content-Type", "text/csv")
      .set("Idempotency-Key", "key-1")
      .send("");

    expect(begin).not.toHaveBeenCalled();
  });

  it("stores the 202 response in the unit that creates the job when the request has a key", async () => {
    const { app, complete } = build();

    const response = await request(app)
      .post("/portfolios/p1/imports")
      .set("Content-Type", "text/csv")
      .set("Idempotency-Key", "key-1")
      .send(CSV);

    expect(response.status).toBe(202);
    // Once in the unit of work, with that unit's repository; the middleware's own
    // settle afterwards is the harmless no-op.
    expect(complete.mock.calls[0]).toEqual([
      {
        userId: "u1",
        key: "key-1",
        responseStatus: 202,
        responseBody: { data: expect.objectContaining({ id: "j1" }) as unknown },
      },
      {},
    ]);
  });
});

describe("job endpoints", () => {
  it("GET answers 200 with the job", async () => {
    const { app, getJobById } = build();

    const response = await request(app).get("/jobs/j1");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { id: "j1" } });
    expect(getJobById).toHaveBeenCalledWith({ userId: "u1", role: "TRADER" }, "j1");
  });

  it("retry answers 202 with the job queued again and wakes the runner", async () => {
    const { app, retryJob, notifyQueued } = build();

    const response = await request(app).post("/jobs/j1/retry");

    expect(response.status).toBe(202);
    expect(response.headers.location).toBe("/api/v1/jobs/j1");
    expect(retryJob).toHaveBeenCalledTimes(1);
    expect(notifyQueued).toHaveBeenCalledTimes(1);
  });

  it("cancel answers 200 with the cancelled job", async () => {
    const { app } = build();

    const response = await request(app).post("/jobs/j1/cancel");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { status: "CANCELLED" } });
  });

  it("answers 404 for a job that is not the actor's", async () => {
    const { app, getJobById } = build();
    getJobById.mockRejectedValueOnce(new NotFoundError("The requested job could not be found."));

    const response = await request(app).get("/jobs/other");

    expect(response.status).toBe(404);
  });

  it.each(["retry", "cancel"] as const)(
    "%s answers 409 when the state does not allow it and does not wake the runner",
    async (action) => {
      const { app, retryJob, cancelJob, notifyQueued } = build();
      const conflict = new ConflictError("The job can no longer be changed.");
      retryJob.mockRejectedValueOnce(conflict);
      cancelJob.mockRejectedValueOnce(conflict);

      const response = await request(app).post(`/jobs/j1/${action}`);

      expect(response.status).toBe(409);
      expect((response.body as { error: { code: string } }).error.code).toBe("CONFLICT");
      expect(notifyQueued).not.toHaveBeenCalled();
    },
  );
});
