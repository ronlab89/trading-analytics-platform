import { describe, expect, it } from "vitest";
import type { Job } from "@trading/domain";
import { jobResponseSchema, presentJob } from "./job.response.js";
import { jobIdParamsSchema } from "./params.schema.js";

const entity: Job = {
  id: "j1",
  userId: "u1",
  portfolioId: "p1",
  type: "CSV_IMPORT",
  status: "FAILED",
  stage: "VALIDATING",
  attempt: 2,
  processed: 0,
  total: 3,
  failureReason: "VALIDATION_FAILED",
  report: [{ row: 2, message: "Unknown symbol." }],
  input: "symbol,type\nAAPL,BUY",
  queuedAt: new Date("2026-10-21T10:00:00.000Z"),
  deadlineAt: new Date("2026-10-21T10:05:00.000Z"),
  createdAt: new Date("2026-10-21T09:59:00.000Z"),
  updatedAt: new Date("2026-10-21T10:01:00.000Z"),
  finishedAt: new Date("2026-10-21T10:01:00.000Z"),
};

describe("job presenter", () => {
  it("presents the job with progress grouped and timestamps as ISO strings", () => {
    const dto = presentJob(entity);

    expect(dto).toEqual({
      id: "j1",
      portfolioId: "p1",
      type: "CSV_IMPORT",
      status: "FAILED",
      stage: "VALIDATING",
      attempt: 2,
      progress: { processed: 0, total: 3 },
      failureReason: "VALIDATION_FAILED",
      report: [{ row: 2, message: "Unknown symbol." }],
      queuedAt: "2026-10-21T10:00:00.000Z",
      deadlineAt: "2026-10-21T10:05:00.000Z",
      createdAt: "2026-10-21T09:59:00.000Z",
      updatedAt: "2026-10-21T10:01:00.000Z",
      finishedAt: "2026-10-21T10:01:00.000Z",
    });
    expect(jobResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("never exposes the CSV input or the owner", () => {
    const dto = presentJob(entity) as unknown as Record<string, unknown>;

    expect(dto).not.toHaveProperty("input");
    expect(dto).not.toHaveProperty("userId");
    expect(JSON.stringify(dto)).not.toContain("AAPL,BUY");
  });

  it("presents a running job with no failure, report or finish time", () => {
    const dto = presentJob({
      ...entity,
      status: "PROCESSING",
      failureReason: null,
      report: null,
      finishedAt: null,
    });

    expect(dto.failureReason).toBeNull();
    expect(dto.report).toBeNull();
    expect(dto.finishedAt).toBeNull();
    expect(jobResponseSchema.safeParse(dto).success).toBe(true);
  });
});

describe("job id params", () => {
  it("accepts a well-formed id and rejects a malformed one", () => {
    expect(jobIdParamsSchema.safeParse({ jobId: "cm1_x-2" }).success).toBe(true);
    expect(jobIdParamsSchema.safeParse({ jobId: "no spaces" }).success).toBe(false);
    expect(jobIdParamsSchema.safeParse({}).success).toBe(false);
  });
});
