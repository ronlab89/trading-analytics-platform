import { describe, expect, it } from "vitest";
import {
  InvalidJobError,
  JobFailureReason,
  JobStage,
  JobStatus,
  canCancelJob,
  canRetryJob,
  isJobTimeoutApplicable,
  isJobTransitionAllowed,
  validateNewJob,
} from "./job";

const valid = {
  userId: "user_1",
  portfolioId: "portfolio_1",
  type: "CSV_IMPORT" as const,
  input: "date,type\n",
  queuedAt: new Date("2026-10-21T10:00:00Z"),
  deadlineAt: new Date("2026-10-21T10:05:00Z"),
};

describe("validateNewJob", () => {
  it("should accept a valid job input", () => {
    expect(() => {
      validateNewJob(valid);
    }).not.toThrow();
  });

  it.each([
    ["userId", { userId: " " }],
    ["portfolioId", { portfolioId: "" }],
    ["input", { input: "" }],
    ["input", { input: null }],
    ["dates", { queuedAt: new Date("not a date") }],
    ["deadline", { deadlineAt: new Date("2026-10-21T10:00:00Z") }],
  ])("should reject a missing or invalid %s", (_field, override) => {
    expect(() => {
      validateNewJob({ ...valid, ...override });
    }).toThrow(InvalidJobError);
  });
});

describe("isJobTransitionAllowed", () => {
  it.each([
    ["QUEUED", "PROCESSING"],
    ["QUEUED", "CANCELLED"],
    ["QUEUED", "TIMED_OUT"],
    ["PROCESSING", "COMPLETED"],
    ["PROCESSING", "FAILED"],
    ["PROCESSING", "CANCELLED"],
    ["PROCESSING", "TIMED_OUT"],
    ["FAILED", "QUEUED"],
    ["CANCELLED", "QUEUED"],
    ["TIMED_OUT", "QUEUED"],
  ] as const)("should allow %s to %s", (from, to) => {
    expect(isJobTransitionAllowed(from, to)).toBe(true);
  });

  it.each([
    ["COMPLETED", "QUEUED"],
    ["COMPLETED", "FAILED"],
    ["QUEUED", "COMPLETED"],
    ["QUEUED", "FAILED"],
    ["FAILED", "COMPLETED"],
    ["CANCELLED", "PROCESSING"],
  ] as const)("should reject %s to %s", (from, to) => {
    expect(isJobTransitionAllowed(from, to)).toBe(false);
  });
});

describe("canRetryJob", () => {
  it.each([
    [JobStatus.TIMED_OUT, null],
    [JobStatus.CANCELLED, null],
    [JobStatus.FAILED, JobFailureReason.INTERRUPTED],
    [JobStatus.FAILED, JobFailureReason.APPLY_ERROR],
    [JobStatus.FAILED, JobFailureReason.APPLY_REJECTED],
  ])("should allow a retry for %s (%s)", (status, failureReason) => {
    expect(canRetryJob({ status, failureReason })).toBe(true);
  });

  it.each([
    [JobStatus.FAILED, JobFailureReason.VALIDATION_FAILED],
    [JobStatus.FAILED, JobFailureReason.PORTFOLIO_ARCHIVED],
    [JobStatus.FAILED, null],
    [JobStatus.COMPLETED, null],
    [JobStatus.QUEUED, null],
    [JobStatus.PROCESSING, null],
  ])("should refuse a retry for %s (%s)", (status, failureReason) => {
    expect(canRetryJob({ status, failureReason })).toBe(false);
  });
});

describe("canCancelJob and isJobTimeoutApplicable", () => {
  it.each([
    [JobStatus.QUEUED, JobStage.QUEUED, true],
    [JobStatus.PROCESSING, JobStage.VALIDATING, true],
    [JobStatus.PROCESSING, JobStage.APPLYING, false],
    [JobStatus.COMPLETED, JobStage.APPLYING, false],
    [JobStatus.FAILED, JobStage.VALIDATING, false],
  ])("should answer for %s in %s", (status, stage, expected) => {
    expect(canCancelJob({ status, stage })).toBe(expected);
    expect(isJobTimeoutApplicable({ status, stage })).toBe(expected);
  });
});
