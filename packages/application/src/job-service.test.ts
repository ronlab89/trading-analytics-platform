import { describe, expect, it, vi } from "vitest";
import {
  InvalidJobError,
  JobFailureReason,
  JobStage,
  JobStatus,
  PortfolioStatus,
} from "@trading/domain";
import type {
  CreateJobInput,
  Job,
  JobRepository,
  Portfolio,
  TransactionalRepositories,
  TransitionJobInput,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import { fixedClock } from "./clock.js";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors.js";
import { capturingLogger } from "./logger.js";
import type { Logger } from "./logger.js";
import { createJobService, DEFAULT_JOB_TIMEOUT_MS } from "./job-service.js";

const actor: Actor = { userId: "u1", role: "TRADER" };
const now = new Date("2026-03-01T12:00:00Z");

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    userId: "u1",
    portfolioId: "p1",
    type: "CSV_IMPORT",
    status: JobStatus.QUEUED,
    stage: JobStage.QUEUED,
    attempt: 1,
    processed: 0,
    total: 0,
    failureReason: null,
    report: null,
    input: "a,b\n1,2",
    queuedAt: new Date("2026-03-01T11:00:00Z"),
    deadlineAt: new Date("2026-03-01T11:05:00Z"),
    createdAt: new Date("2026-03-01T11:00:00Z"),
    updatedAt: new Date("2026-03-01T11:00:00Z"),
    finishedAt: null,
    ...overrides,
  };
}

/** A repository with the real compare-and-set rule: a mismatch changes nothing. */
function build(options: { stored?: Job; portfolioStatus?: PortfolioStatus; logger?: Logger } = {}) {
  let stored: Job | null = options.stored ?? null;
  const transitions: TransitionJobInput[] = [];
  const created: CreateJobInput[] = [];

  const jobRepository: Pick<JobRepository, "create" | "getById" | "transition"> = {
    create: (input) => {
      created.push(input);
      stored = job({ ...input, status: JobStatus.QUEUED, stage: JobStage.QUEUED });
      return Promise.resolve(stored);
    },
    getById: (id) => Promise.resolve(stored?.id === id ? stored : null),
    transition: (input) => {
      transitions.push(input);
      const { expected, patch, updatedAt } = input;

      if (
        stored?.status !== expected.status ||
        stored.stage !== expected.stage ||
        stored.attempt !== expected.attempt
      ) {
        return Promise.resolve(null);
      }

      stored = { ...stored, ...patch, updatedAt };
      return Promise.resolve(stored);
    },
  };

  const service = createJobService({
    jobRepository,
    unitOfWork: {
      run: (work) => work({ jobs: jobRepository } as unknown as TransactionalRepositories),
    },
    portfolioService: {
      getPortfolioById: (_actor, portfolioId) =>
        portfolioId === "p1"
          ? Promise.resolve({
              id: "p1",
              status: options.portfolioStatus ?? PortfolioStatus.ACTIVE,
            } as Portfolio)
          : Promise.reject(new NotFoundError("The requested portfolio could not be found.")),
    },
    clock: fixedClock(now),
    ...(options.logger ? { logger: options.logger } : {}),
  });

  return {
    service,
    transitions,
    created,
    /** Simulates another request moving the job on between the read and the write. */
    moveOn: (patch: Partial<Job>) => {
      if (stored) {
        stored = { ...stored, ...patch };
      }
    },
    current: () => stored,
  };
}

describe("job service: create", () => {
  it("queues a job with a deadline one timeout after now", async () => {
    const { service, created } = build();

    const result = await service.createJob(actor, "p1", { type: "CSV_IMPORT", input: "a,b" });

    expect(result.status).toBe(JobStatus.QUEUED);
    expect(created).toEqual([
      {
        userId: "u1",
        portfolioId: "p1",
        type: "CSV_IMPORT",
        input: "a,b",
        queuedAt: now,
        deadlineAt: new Date(now.getTime() + DEFAULT_JOB_TIMEOUT_MS),
      },
    ]);
  });

  it("runs the withinUnit hook in the unit that creates the job, with the created job", async () => {
    const { service } = build();
    const withinUnit = vi.fn((_job: Job, _repositories: TransactionalRepositories) =>
      Promise.resolve(),
    );

    const result = await service.createJob(
      actor,
      "p1",
      { type: "CSV_IMPORT", input: "a,b" },
      withinUnit,
    );

    expect(withinUnit).toHaveBeenCalledTimes(1);
    expect(withinUnit.mock.calls[0]?.[0]).toBe(result);
    expect(withinUnit.mock.calls[0]?.[1]).toHaveProperty("jobs");
  });

  it("fails the creation when the withinUnit hook fails, so the unit can roll back", async () => {
    const { service } = build();

    await expect(
      service.createJob(actor, "p1", { type: "CSV_IMPORT", input: "a,b" }, () =>
        Promise.reject(new Error("db down")),
      ),
    ).rejects.toThrow("db down");
  });

  it("rejects an empty input without creating anything", async () => {
    const { service, created } = build();

    await expect(
      service.createJob(actor, "p1", { type: "CSV_IMPORT", input: "" }),
    ).rejects.toBeInstanceOf(InvalidJobError);
    expect(created).toHaveLength(0);
  });

  it("reads another user's portfolio as missing", async () => {
    const { service, created } = build();

    await expect(
      service.createJob(actor, "other", { type: "CSV_IMPORT", input: "a,b" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(created).toHaveLength(0);
  });

  it("does not queue a job on an archived portfolio", async () => {
    const { service, created } = build({ portfolioStatus: PortfolioStatus.ARCHIVED });

    await expect(
      service.createJob(actor, "p1", { type: "CSV_IMPORT", input: "a,b" }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(created).toHaveLength(0);
  });

  it("requires transaction:create", async () => {
    const { service } = build();

    await expect(
      service.createJob({ userId: "u1", role: "VIEWER" }, "p1", {
        type: "CSV_IMPORT",
        input: "a,b",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("job service: read", () => {
  it("returns the actor's job", async () => {
    const { service } = build({ stored: job() });

    expect((await service.getJobById(actor, "j1")).id).toBe("j1");
  });

  it("reads another user's job as missing", async () => {
    const { service } = build({ stored: job({ userId: "u2" }) });

    await expect(service.getJobById(actor, "j1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("allows a viewer to read", async () => {
    const { service } = build({ stored: job() });

    expect((await service.getJobById({ userId: "u1", role: "VIEWER" }, "j1")).id).toBe("j1");
  });
});

describe("job service: cancel", () => {
  it("cancels a queued job and stamps the finish time", async () => {
    const { service } = build({ stored: job() });

    const result = await service.cancelJob(actor, "j1");

    expect(result.status).toBe(JobStatus.CANCELLED);
    expect(result.finishedAt).toEqual(now);
  });

  it("cancels a job that is validating", async () => {
    const { service } = build({
      stored: job({ status: JobStatus.PROCESSING, stage: JobStage.VALIDATING }),
    });

    expect((await service.cancelJob(actor, "j1")).status).toBe(JobStatus.CANCELLED);
  });

  it("refuses to cancel during apply and changes nothing", async () => {
    const applying = job({ status: JobStatus.PROCESSING, stage: JobStage.APPLYING });
    const { service, transitions, current } = build({ stored: applying });

    await expect(service.cancelJob(actor, "j1")).rejects.toBeInstanceOf(ConflictError);
    expect(transitions).toHaveLength(0);
    expect(current()).toEqual(applying);
  });

  it("refuses to cancel a finished job", async () => {
    const { service } = build({
      stored: job({ status: JobStatus.COMPLETED, stage: JobStage.APPLYING }),
    });

    await expect(service.cancelJob(actor, "j1")).rejects.toBeInstanceOf(ConflictError);
  });

  it("is a conflict when the job moved on after it was read", async () => {
    const { service, moveOn, transitions } = build({ stored: job() });
    const pending = service.cancelJob(actor, "j1");
    moveOn({ status: JobStatus.PROCESSING, stage: JobStage.APPLYING });

    await expect(pending).rejects.toBeInstanceOf(ConflictError);
    expect(transitions).toHaveLength(1);
  });

  it("reads another user's job as missing", async () => {
    const { service } = build({ stored: job({ userId: "u2" }) });

    await expect(service.cancelJob(actor, "j1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("requires transaction:create", async () => {
    const { service } = build({ stored: job() });

    await expect(service.cancelJob({ userId: "u1", role: "VIEWER" }, "j1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("job service: retry", () => {
  const failed = (reason: JobFailureReason) =>
    job({
      status: JobStatus.FAILED,
      stage: JobStage.APPLYING,
      attempt: 2,
      processed: 3,
      total: 9,
      failureReason: reason,
      report: [{ row: 1, message: "bad" }],
      finishedAt: new Date("2026-03-01T11:30:00Z"),
    });

  it.each([
    JobFailureReason.INTERRUPTED,
    JobFailureReason.APPLY_ERROR,
    JobFailureReason.APPLY_REJECTED,
  ])("requeues a job that failed with %s as the next attempt", async (reason) => {
    const { service } = build({ stored: failed(reason) });

    const result = await service.retryJob(actor, "j1");

    expect(result).toMatchObject({
      status: JobStatus.QUEUED,
      stage: JobStage.QUEUED,
      attempt: 3,
      processed: 0,
      total: 0,
      failureReason: null,
      report: null,
      finishedAt: null,
      queuedAt: now,
      deadlineAt: new Date(now.getTime() + DEFAULT_JOB_TIMEOUT_MS),
    });
  });

  it.each([JobStatus.TIMED_OUT, JobStatus.CANCELLED])("requeues a %s job", async (status) => {
    const { service } = build({ stored: job({ status, stage: JobStage.VALIDATING }) });

    expect((await service.retryJob(actor, "j1")).status).toBe(JobStatus.QUEUED);
  });

  it.each([JobFailureReason.VALIDATION_FAILED, JobFailureReason.PORTFOLIO_ARCHIVED])(
    "refuses to retry a job that failed with %s and changes nothing",
    async (reason) => {
      const stored = failed(reason);
      const { service, transitions, current } = build({ stored });

      await expect(service.retryJob(actor, "j1")).rejects.toBeInstanceOf(ConflictError);
      expect(transitions).toHaveLength(0);
      expect(current()).toEqual(stored);
    },
  );

  it("refuses to retry a job that is not finished", async () => {
    const { service } = build({ stored: job() });

    await expect(service.retryJob(actor, "j1")).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses to retry a job whose input was cleared", async () => {
    const { service } = build({
      stored: job({ status: JobStatus.CANCELLED, input: null }),
    });

    await expect(service.retryJob(actor, "j1")).rejects.toBeInstanceOf(ConflictError);
  });

  it("lets only one of two racing retries win", async () => {
    const { service } = build({ stored: failed(JobFailureReason.APPLY_ERROR) });

    const results = await Promise.allSettled([
      service.retryJob(actor, "j1"),
      service.retryJob(actor, "j1"),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("requires transaction:create", async () => {
    const { service } = build({ stored: failed(JobFailureReason.APPLY_ERROR) });

    await expect(service.retryJob({ userId: "u1", role: "VIEWER" }, "j1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("job service: log events", () => {
  it("logs job.queued with the jobId when a job is created", async () => {
    const logger = capturingLogger();
    const { service } = build({ logger });

    const created = await service.createJob(actor, "p1", { type: "CSV_IMPORT", input: "a,b" });

    expect(logger.entries).toEqual([
      {
        level: "info",
        event: "job.queued",
        fields: { jobId: created.id, userId: "u1", type: "CSV_IMPORT", attempt: 1 },
      },
    ]);
  });

  it("logs job.cancelled with the stage it was cancelled in", async () => {
    const logger = capturingLogger();
    const { service } = build({ stored: job(), logger });

    await service.cancelJob(actor, "j1");

    expect(logger.entries).toEqual([
      {
        level: "info",
        event: "job.cancelled",
        fields: { jobId: "j1", userId: "u1", type: "CSV_IMPORT", attempt: 1, stage: "QUEUED" },
      },
    ]);
  });

  it("logs job.queued with the next attempt when a job is retried", async () => {
    const logger = capturingLogger();
    const { service } = build({
      stored: job({ status: JobStatus.TIMED_OUT, stage: JobStage.VALIDATING }),
      logger,
    });

    await service.retryJob(actor, "j1");

    expect(logger.entries).toEqual([
      {
        level: "info",
        event: "job.queued",
        fields: { jobId: "j1", userId: "u1", type: "CSV_IMPORT", attempt: 2 },
      },
    ]);
  });

  it("logs nothing when the request is refused", async () => {
    const logger = capturingLogger();
    const { service } = build({
      stored: job({ status: JobStatus.COMPLETED, stage: JobStage.APPLYING }),
      logger,
    });

    await service.cancelJob(actor, "j1").catch(() => undefined);
    await service.retryJob(actor, "j1").catch(() => undefined);

    expect(logger.entries).toEqual([]);
  });
});
