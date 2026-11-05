import { describe, expect, it } from "vitest";
import { isJobFinished } from "./job-state";

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
