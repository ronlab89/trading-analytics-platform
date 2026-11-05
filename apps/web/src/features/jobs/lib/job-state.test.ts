import { describe, expect, it } from "vitest";
import { canCancelJob, canRetryJob, isJobFinished, jobPhase } from "./job-state";

describe("isJobFinished", () => {
  it("is false while the job waits or runs", () => {
    expect(isJobFinished({ status: "QUEUED" })).toBe(false);
    expect(isJobFinished({ status: "PROCESSING" })).toBe(false);
  });

  it("is true in every end state", () => {
    for (const status of ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"] as const) {
      expect(isJobFinished({ status })).toBe(true);
    }
  });
});

describe("canCancelJob", () => {
  it("is true while the job waits, whatever its stage", () => {
    expect(canCancelJob({ status: "QUEUED", stage: "QUEUED" })).toBe(true);
  });

  it("is true while the job validates", () => {
    expect(canCancelJob({ status: "PROCESSING", stage: "VALIDATING" })).toBe(true);
  });

  it("is false once the job applies its rows", () => {
    expect(canCancelJob({ status: "PROCESSING", stage: "APPLYING" })).toBe(false);
  });

  it("is false in every end state", () => {
    for (const status of ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"] as const) {
      expect(canCancelJob({ status, stage: "VALIDATING" })).toBe(false);
    }
  });
});

describe("canRetryJob", () => {
  it("is true for a job that timed out or was cancelled", () => {
    expect(canRetryJob({ status: "TIMED_OUT", failureReason: null })).toBe(true);
    expect(canRetryJob({ status: "CANCELLED", failureReason: null })).toBe(true);
  });

  it("is true for a failure that is not in the file or the portfolio", () => {
    for (const failureReason of ["INTERRUPTED", "APPLY_ERROR", "APPLY_REJECTED"] as const) {
      expect(canRetryJob({ status: "FAILED", failureReason })).toBe(true);
    }
  });

  it("is false for a file that failed validation and for an archived portfolio", () => {
    expect(canRetryJob({ status: "FAILED", failureReason: "VALIDATION_FAILED" })).toBe(false);
    expect(canRetryJob({ status: "FAILED", failureReason: "PORTFOLIO_ARCHIVED" })).toBe(false);
  });

  it("is false for a job that is not finished or that completed", () => {
    expect(canRetryJob({ status: "QUEUED", failureReason: null })).toBe(false);
    expect(canRetryJob({ status: "PROCESSING", failureReason: null })).toBe(false);
    expect(canRetryJob({ status: "COMPLETED", failureReason: null })).toBe(false);
  });
});

describe("jobPhase", () => {
  it("names a running job by its stage", () => {
    expect(jobPhase({ status: "PROCESSING", stage: "VALIDATING" })).toBe("VALIDATING");
    expect(jobPhase({ status: "PROCESSING", stage: "APPLYING" })).toBe("APPLYING");
  });

  it("names any other job by its status", () => {
    expect(jobPhase({ status: "QUEUED", stage: "QUEUED" })).toBe("QUEUED");
    for (const status of ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"] as const) {
      expect(jobPhase({ status, stage: "APPLYING" })).toBe(status);
    }
  });
});
