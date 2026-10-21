import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobFailureReason, JobStage, JobStatus } from "@trading/domain";
import type { Job, JobRepository } from "@trading/domain";
import {
  JobApplyRejectedError,
  JobPortfolioArchivedError,
  JobSupersededError,
  createJobRunner,
} from "./job-runner.js";
import type { JobHandler } from "./job-runner.js";

const START = new Date("2026-03-01T12:00:00Z");
const FIVE_MINUTES = 5 * 60 * 1000;

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function queuedJob(id: string, overrides: Partial<Job> = {}): Job {
  const queuedAt = overrides.queuedAt ?? new Date(START.getTime());
  return {
    id,
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
    input: "a,b",
    queuedAt,
    deadlineAt: new Date(queuedAt.getTime() + FIVE_MINUTES),
    createdAt: queuedAt,
    updatedAt: queuedAt,
    finishedAt: null,
    ...overrides,
  };
}

/** A repository with the real compare-and-set rule, as the contract suites pin it. */
function fakeRepository(initial: Job[]) {
  const rows = new Map(initial.map((job) => [job.id, job]));

  const repository: Pick<JobRepository, "listByStatuses" | "transition"> = {
    listByStatuses: (statuses) =>
      Promise.resolve(
        [...rows.values()]
          .filter((job) => statuses.includes(job.status))
          .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime()),
      ),
    transition: ({ id, expected, patch, updatedAt }) => {
      const stored = rows.get(id);

      if (
        stored?.status !== expected.status ||
        stored.stage !== expected.stage ||
        stored.attempt !== expected.attempt
      ) {
        return Promise.resolve(null);
      }

      const next = { ...stored, ...patch, updatedAt };
      rows.set(id, next);
      return Promise.resolve(next);
    },
  };

  return {
    repository,
    get: (id: string): Job => {
      const job = rows.get(id);

      if (!job) {
        throw new Error(`No job ${id}.`);
      }

      return job;
    },
    add: (job: Job) => {
      rows.set(job.id, job);
    },
  };
}

/** A handler that validates cleanly and applies by completing the job. */
function okHandler(repository: Pick<JobRepository, "transition">): JobHandler {
  return {
    validate: vi.fn<JobHandler["validate"]>(async (_job, report) => {
      await report(1, 3);
      return { total: 3, errors: [] };
    }),
    apply: vi.fn<JobHandler["apply"]>(async (_job, context) => {
      if (!(await context.complete(repository))) {
        throw new JobSupersededError();
      }
    }),
  };
}

const clock = { now: () => new Date() };

function build(initial: Job[], makeHandler: (r: Pick<JobRepository, "transition">) => JobHandler) {
  const { repository, get, add } = fakeRepository(initial);
  const handler = makeHandler(repository);
  const runner = createJobRunner({
    jobRepository: repository,
    handlers: { CSV_IMPORT: handler },
    clock,
    pollIntervalMs: 1000,
  });

  return { runner, handler, repository, get, add };
}

/** Lets the runner's promise chains settle without moving the clock. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("job runner: stages", () => {
  it("runs a queued job through validation and apply and completes it", async () => {
    const { runner, handler, get } = build([queuedJob("j1")], okHandler);

    runner.start();
    await settle();

    expect(get("j1")).toMatchObject({
      status: JobStatus.COMPLETED,
      input: null,
      processed: 3,
      total: 3,
      finishedAt: START,
    });
    expect(handler.validate).toHaveBeenCalledTimes(1);
    expect(handler.apply).toHaveBeenCalledTimes(1);
    await runner.stop();
  });

  it("stores the progress the handler reports while validating", async () => {
    const gate = deferred();
    const { runner, get } = build([queuedJob("j1")], (repository) => ({
      validate: async (_job, report) => {
        await report(2, 10);
        await gate.promise;
        return { total: 10, errors: [] };
      },
      apply: async (_job, context) => {
        await context.complete(repository);
      },
    }));

    runner.start();
    await settle();

    expect(get("j1")).toMatchObject({
      status: JobStatus.PROCESSING,
      stage: JobStage.VALIDATING,
      processed: 2,
      total: 10,
    });

    gate.resolve();
    await settle();
    await runner.stop();
  });

  it("fails a job with invalid rows, keeps the report, clears the input and applies nothing", async () => {
    const errors = [{ row: 2, message: "Unknown asset." }];
    const { runner, handler, get } = build([queuedJob("j1")], () => ({
      validate: () => Promise.resolve({ total: 4, errors }),
      apply: vi.fn(() => Promise.resolve()),
    }));

    runner.start();
    await settle();

    expect(get("j1")).toMatchObject({
      status: JobStatus.FAILED,
      failureReason: JobFailureReason.VALIDATION_FAILED,
      report: errors,
      input: null,
      total: 4,
    });
    expect(handler.apply).not.toHaveBeenCalled();
    await runner.stop();
  });

  it("fails a job whose validation crashes as interrupted and keeps the input for a retry", async () => {
    const { runner, get } = build([queuedJob("j1")], () => ({
      validate: () => Promise.reject(new Error("boom")),
      apply: () => Promise.resolve(),
    }));

    runner.start();
    await settle();

    expect(get("j1")).toMatchObject({
      status: JobStatus.FAILED,
      failureReason: JobFailureReason.INTERRUPTED,
      input: "a,b",
    });
    await runner.stop();
  });

  it.each([
    [new JobApplyRejectedError("oversell"), JobFailureReason.APPLY_REJECTED, "a,b"],
    [new JobPortfolioArchivedError("archived"), JobFailureReason.PORTFOLIO_ARCHIVED, null],
    [new Error("db down"), JobFailureReason.APPLY_ERROR, "a,b"],
  ])("maps an apply failure to its reason (%s)", async (error, reason, input) => {
    const { runner, get } = build([queuedJob("j1")], () => ({
      validate: () => Promise.resolve({ total: 1, errors: [] }),
      apply: () => Promise.reject(error),
    }));

    runner.start();
    await settle();

    expect(get("j1")).toMatchObject({ status: JobStatus.FAILED, failureReason: reason, input });
    await runner.stop();
  });

  it("leaves the job as it is when the apply was superseded", async () => {
    const { runner, get } = build([queuedJob("j1")], () => ({
      validate: () => Promise.resolve({ total: 1, errors: [] }),
      apply: () => Promise.reject(new JobSupersededError()),
    }));

    runner.start();
    await settle();

    expect(get("j1")).toMatchObject({ status: JobStatus.PROCESSING, stage: JobStage.APPLYING });
    await runner.stop();
  });
});

describe("job runner: picking jobs", () => {
  it("runs queued jobs one at a time, oldest first", async () => {
    const order: string[] = [];
    const gate = deferred();
    const { runner } = build(
      [
        queuedJob("late", { queuedAt: new Date(START.getTime() + 2000) }),
        queuedJob("early", { queuedAt: new Date(START.getTime() + 1000) }),
      ],
      (repository) => ({
        validate: async (job) => {
          order.push(`start ${job.id}`);
          await gate.promise;
          order.push(`end ${job.id}`);
          return { total: 1, errors: [] };
        },
        apply: async (_job, context) => {
          await context.complete(repository);
        },
      }),
    );

    vi.setSystemTime(new Date(START.getTime() + 3000));
    runner.start();
    await settle();
    expect(order).toEqual(["start early"]);

    gate.resolve();
    await settle();

    expect(order).toEqual(["start early", "end early", "start late", "end late"]);
    await runner.stop();
  });

  it("runs a job once when the poll and a notification race for it", async () => {
    const { runner, handler } = build([queuedJob("j1")], okHandler);

    runner.start();
    runner.notifyQueued();
    runner.notifyQueued();
    await vi.advanceTimersByTimeAsync(3000);

    expect(handler.validate).toHaveBeenCalledTimes(1);
    expect(handler.apply).toHaveBeenCalledTimes(1);
    await runner.stop();
  });

  it("runs a job once when two runners race for it", async () => {
    const { repository, get } = fakeRepository([queuedJob("j1")]);
    const handler = okHandler(repository);
    const make = () =>
      createJobRunner({
        jobRepository: repository,
        handlers: { CSV_IMPORT: handler },
        clock,
        pollIntervalMs: 1000,
      });
    const first = make();
    const second = make();

    first.start();
    second.start();
    await settle();

    expect(handler.validate).toHaveBeenCalledTimes(1);
    expect(get("j1").status).toBe(JobStatus.COMPLETED);
    await first.stop();
    await second.stop();
  });

  it("picks up a job queued after the runner started on the next poll", async () => {
    const { runner, add, handler, get } = build([], okHandler);
    runner.start();
    await settle();
    expect(handler.validate).not.toHaveBeenCalled();

    add(queuedJob("j2", { queuedAt: new Date() }));
    await vi.advanceTimersByTimeAsync(1000);

    expect(get("j2").status).toBe(JobStatus.COMPLETED);
    await runner.stop();
  });

  it("takes no job after stop", async () => {
    const { runner, handler } = build([queuedJob("j1")], okHandler);

    runner.start();
    await runner.stop();
    await settle();
    runner.notifyQueued();
    await vi.advanceTimersByTimeAsync(5000);

    expect(handler.validate).not.toHaveBeenCalled();
  });
});

describe("job runner: timeout", () => {
  it("times out a queued job past its deadline without running it", async () => {
    const { runner, handler, get } = build(
      [queuedJob("old", { queuedAt: new Date(START.getTime() - 2 * FIVE_MINUTES) })],
      okHandler,
    );

    runner.start();
    await settle();

    expect(get("old")).toMatchObject({ status: JobStatus.TIMED_OUT, finishedAt: START });
    expect(handler.validate).not.toHaveBeenCalled();
    await runner.stop();
  });

  it("times out a job waiting behind a long one while that one still runs", async () => {
    const gate = deferred();
    const { runner, get } = build(
      [
        queuedJob("long", { deadlineAt: new Date(START.getTime() + 60 * 60 * 1000) }),
        queuedJob("waiting", { queuedAt: new Date(START.getTime() + 1) }),
      ],
      (repository) => ({
        validate: async () => {
          await gate.promise;
          return { total: 1, errors: [] };
        },
        apply: async (_job, context) => {
          await context.complete(repository);
        },
      }),
    );

    runner.start();
    await vi.advanceTimersByTimeAsync(FIVE_MINUTES + 2000);

    expect(get("waiting").status).toBe(JobStatus.TIMED_OUT);
    expect(get("long").status).toBe(JobStatus.PROCESSING);

    gate.resolve();
    await settle();
    await runner.stop();
  });

  it("times out a job whose validation outlasts the deadline and applies nothing", async () => {
    const gate = deferred();
    let reported: boolean | null = null;
    const { runner, handler, get } = build([queuedJob("j1")], () => ({
      validate: async (_job, report) => {
        await gate.promise;
        reported = await report(5, 5);
        return { total: 5, errors: [] };
      },
      apply: vi.fn(() => Promise.resolve()),
    }));

    runner.start();
    await vi.advanceTimersByTimeAsync(FIVE_MINUTES + 1);
    expect(get("j1").status).toBe(JobStatus.TIMED_OUT);

    gate.resolve();
    await settle();

    expect(reported).toBe(false);
    expect(get("j1").status).toBe(JobStatus.TIMED_OUT);
    expect(handler.apply).not.toHaveBeenCalled();
    await runner.stop();
  });

  it("never times out the apply stage", async () => {
    const gate = deferred();
    const { runner, get } = build([queuedJob("j1")], (repository) => ({
      validate: () => Promise.resolve({ total: 1, errors: [] }),
      apply: async (_job, context) => {
        await gate.promise;
        await context.complete(repository);
      },
    }));

    runner.start();
    await vi.advanceTimersByTimeAsync(2 * FIVE_MINUTES);
    expect(get("j1")).toMatchObject({ status: JobStatus.PROCESSING, stage: JobStage.APPLYING });

    gate.resolve();
    await settle();

    expect(get("j1").status).toBe(JobStatus.COMPLETED);
    await runner.stop();
  });

  it("gives a retried job a fresh deadline so it does not time out at once", async () => {
    const retriedAt = new Date(START.getTime() + 3 * FIVE_MINUTES);
    vi.setSystemTime(retriedAt);
    const { runner, get } = build(
      [queuedJob("j1", { attempt: 2, queuedAt: retriedAt })],
      okHandler,
    );

    runner.start();
    await settle();

    expect(get("j1").status).toBe(JobStatus.COMPLETED);
    await runner.stop();
  });
});

describe("job runner: cancellation", () => {
  it("stops a job cancelled while it validates and applies nothing", async () => {
    const gate = deferred();
    let reported: boolean | null = null;
    const { runner, handler, repository, get } = build([queuedJob("j1")], () => ({
      validate: async (_job, report) => {
        await gate.promise;
        reported = await report(1, 1);
        return { total: 1, errors: [] };
      },
      apply: vi.fn(() => Promise.resolve()),
    }));

    runner.start();
    await settle();
    await repository.transition({
      id: "j1",
      expected: { status: JobStatus.PROCESSING, stage: JobStage.VALIDATING, attempt: 1 },
      patch: { status: JobStatus.CANCELLED, finishedAt: new Date() },
      updatedAt: new Date(),
    });

    gate.resolve();
    await settle();

    expect(reported).toBe(false);
    expect(get("j1").status).toBe(JobStatus.CANCELLED);
    expect(handler.apply).not.toHaveBeenCalled();
    await runner.stop();
  });
});
