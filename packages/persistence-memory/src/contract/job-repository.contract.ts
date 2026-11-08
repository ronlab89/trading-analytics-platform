import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { JobRepository } from "@trading/domain";

export interface JobContractContext {
  readonly repository: JobRepository;
  readonly fixtures: {
    /** An existing user that owns the jobs created by the suite. */
    readonly userId: string;
    /** An existing portfolio of that user. */
    readonly portfolioId: string;
  };
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/**
 * Behavior every `JobRepository` must have, whatever the storage.
 * Source: ADR-008 points 3-7 and Deferred detail (racing transitions).
 *
 * `transition` is the compare-and-set the runner, cancel and retry rely on,
 * so most of the suite pins what it refuses to do.
 */
export function jobRepositoryContract(
  name: string,
  factory: () => Promise<JobContractContext>,
): void {
  describe(`${name} (JobRepository contract)`, () => {
    let context: JobContractContext;

    beforeEach(async () => {
      context = await factory();
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const queuedAt = new Date("2026-10-21T10:00:00.000Z");
    const deadlineAt = new Date("2026-10-21T10:05:00.000Z");
    const updatedAt = new Date("2026-10-21T10:00:30.000Z");
    const input = (csv = "date,type\n") => ({
      userId: context.fixtures.userId,
      portfolioId: context.fixtures.portfolioId,
      type: "CSV_IMPORT" as const,
      input: csv,
      queuedAt,
      deadlineAt,
    });
    const queued = { status: "QUEUED", stage: "QUEUED", attempt: 1 } as const;

    it("returns null for a job that does not exist", async () => {
      expect(await context.repository.getById("missing")).toBeNull();
    });

    it("creates a queued job in its first attempt with no progress or failure", async () => {
      const created = await context.repository.create(input());

      expect(created).toMatchObject({
        ...input(),
        status: "QUEUED",
        stage: "QUEUED",
        attempt: 1,
        processed: 0,
        total: 0,
        failureReason: null,
        report: null,
        finishedAt: null,
      });
      expect(created.id).toEqual(expect.any(String));
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toEqual(created.createdAt);
      expect(created.queuedAt).toEqual(queuedAt);
      expect(created.deadlineAt).toEqual(deadlineAt);
      expect(await context.repository.getById(created.id)).toEqual(created);
    });

    it("gives every job its own id", async () => {
      const first = await context.repository.create(input());
      const second = await context.repository.create(input());

      expect(second.id).not.toBe(first.id);
    });

    it("applies a transition when the job matches what was expected", async () => {
      const created = await context.repository.create(input());

      const moved = await context.repository.transition({
        id: created.id,
        expected: queued,
        patch: { status: "PROCESSING", stage: "VALIDATING", total: 3 },
        updatedAt,
      });

      expect(moved).toMatchObject({
        id: created.id,
        status: "PROCESSING",
        stage: "VALIDATING",
        attempt: 1,
        total: 3,
        processed: 0,
        input: created.input,
      });
      expect(moved?.updatedAt).toEqual(updatedAt);
      expect(await context.repository.getById(created.id)).toEqual(moved);
    });

    it("changes only the fields of the patch", async () => {
      const created = await context.repository.create(input());

      const moved = await context.repository.transition({
        id: created.id,
        expected: queued,
        patch: { processed: 2 },
        updatedAt,
      });

      expect(moved).toEqual({ ...created, processed: 2, updatedAt });
    });

    it("stores a failure with its reason, report and finish time, and clears the input", async () => {
      const created = await context.repository.create(input());
      const finishedAt = new Date("2026-10-21T10:01:00.000Z");
      const report = [
        { row: 2, message: "Unknown asset." },
        { row: 5, message: "SELL exceeds the position." },
      ];

      const failed = await context.repository.transition({
        id: created.id,
        expected: queued,
        patch: {
          status: "FAILED",
          failureReason: "VALIDATION_FAILED",
          report,
          input: null,
          finishedAt,
        },
        updatedAt,
      });

      expect(failed).toMatchObject({
        status: "FAILED",
        failureReason: "VALIDATION_FAILED",
        report,
        input: null,
        finishedAt,
      });
      expect(await context.repository.getById(created.id)).toEqual(failed);
    });

    it("resolves null and changes nothing when the status is not the expected one", async () => {
      const created = await context.repository.create(input());

      const result = await context.repository.transition({
        id: created.id,
        expected: { ...queued, status: "PROCESSING" },
        patch: { status: "COMPLETED" },
        updatedAt,
      });

      expect(result).toBeNull();
      expect(await context.repository.getById(created.id)).toEqual(created);
    });

    it("resolves null when the stage is not the expected one", async () => {
      const created = await context.repository.create(input());

      const result = await context.repository.transition({
        id: created.id,
        expected: { ...queued, stage: "APPLYING" },
        patch: { status: "PROCESSING" },
        updatedAt,
      });

      expect(result).toBeNull();
      expect(await context.repository.getById(created.id)).toEqual(created);
    });

    it("resolves null when the attempt is not the expected one", async () => {
      const created = await context.repository.create(input());

      const result = await context.repository.transition({
        id: created.id,
        expected: { ...queued, attempt: 2 },
        patch: { status: "PROCESSING" },
        updatedAt,
      });

      expect(result).toBeNull();
      expect(await context.repository.getById(created.id)).toEqual(created);
    });

    it("resolves null for a job that does not exist", async () => {
      expect(
        await context.repository.transition({
          id: "missing",
          expected: queued,
          patch: { status: "PROCESSING" },
          updatedAt,
        }),
      ).toBeNull();
    });

    it("lets only one of two racing transitions win", async () => {
      const created = await context.repository.create(input());
      const claim = (stage: "VALIDATING" | "APPLYING") =>
        context.repository.transition({
          id: created.id,
          expected: queued,
          patch: { status: "PROCESSING", stage },
          updatedAt,
        });

      const results = await Promise.all([claim("VALIDATING"), claim("APPLYING")]);

      expect(results.filter((result) => result !== null)).toHaveLength(1);
    });

    it("supports a retry: back to queued with the next attempt and a fresh deadline", async () => {
      const created = await context.repository.create(input());
      await context.repository.transition({
        id: created.id,
        expected: queued,
        patch: { status: "TIMED_OUT", finishedAt: updatedAt },
        updatedAt,
      });
      const newQueuedAt = new Date("2026-10-21T11:00:00.000Z");
      const newDeadlineAt = new Date("2026-10-21T11:05:00.000Z");

      const retried = await context.repository.transition({
        id: created.id,
        expected: { status: "TIMED_OUT", stage: "QUEUED", attempt: 1 },
        patch: {
          status: "QUEUED",
          attempt: 2,
          processed: 0,
          failureReason: null,
          report: null,
          queuedAt: newQueuedAt,
          deadlineAt: newDeadlineAt,
          finishedAt: null,
        },
        updatedAt: newQueuedAt,
      });

      expect(retried).toMatchObject({
        status: "QUEUED",
        attempt: 2,
        queuedAt: newQueuedAt,
        deadlineAt: newDeadlineAt,
        finishedAt: null,
      });
    });

    it("lists the jobs in the given statuses, oldest queued first", async () => {
      const later = await context.repository.create({
        ...input(),
        queuedAt: new Date("2026-10-21T10:02:00.000Z"),
        deadlineAt: new Date("2026-10-21T10:07:00.000Z"),
      });
      const earlier = await context.repository.create(input());
      const processing = await context.repository.create(input());
      await context.repository.transition({
        id: processing.id,
        expected: queued,
        patch: { status: "PROCESSING", stage: "VALIDATING" },
        updatedAt,
      });

      const queuedJobs = await context.repository.listByStatuses(["QUEUED"]);
      const both = await context.repository.listByStatuses(["QUEUED", "PROCESSING"]);

      expect(queuedJobs.map((job) => job.id)).toEqual([earlier.id, later.id]);
      expect(both.map((job) => job.id)).toHaveLength(3);
      expect(await context.repository.listByStatuses(["COMPLETED"])).toEqual([]);
    });
  });
}
