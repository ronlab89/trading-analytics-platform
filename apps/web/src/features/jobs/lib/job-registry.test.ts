import { beforeEach, describe, expect, it } from "vitest";
import {
  addTrackedJob,
  type JobStorage,
  MAX_TRACKED_JOBS,
  readTrackedJobs,
  removeTrackedJob,
  type TrackedJob,
} from "./job-registry";

const job = (id: string, startedAt = "2026-11-07T10:00:00.000Z"): TrackedJob => ({
  id,
  portfolioId: "p1",
  fileName: `${id}.csv`,
  startedAt,
});

function memoryStorage(): JobStorage & { clear: () => void } {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    clear: () => {
      items.clear();
    },
  };
}

const sessionStorage = memoryStorage();

beforeEach(() => {
  sessionStorage.clear();
});

describe("job registry", () => {
  it("is empty until a job is added", () => {
    expect(readTrackedJobs(sessionStorage, "u1")).toEqual([]);
  });

  it("keeps the newest job first", () => {
    addTrackedJob(sessionStorage, "u1", job("j1"));
    const jobs = addTrackedJob(sessionStorage, "u1", job("j2"));

    expect(jobs.map(({ id }) => id)).toEqual(["j2", "j1"]);
    expect(readTrackedJobs(sessionStorage, "u1")).toEqual(jobs);
  });

  it("holds a job once, even if it is added again", () => {
    addTrackedJob(sessionStorage, "u1", job("j1"));
    const jobs = addTrackedJob(sessionStorage, "u1", job("j1"));

    expect(jobs).toHaveLength(1);
  });

  it("keeps the jobs of each user apart", () => {
    addTrackedJob(sessionStorage, "u1", job("j1"));

    expect(readTrackedJobs(sessionStorage, "u2")).toEqual([]);
  });

  it("drops the oldest jobs past the limit", () => {
    for (let index = 0; index < MAX_TRACKED_JOBS + 3; index += 1) {
      addTrackedJob(sessionStorage, "u1", job(`j${String(index)}`));
    }
    const jobs = readTrackedJobs(sessionStorage, "u1");

    expect(jobs).toHaveLength(MAX_TRACKED_JOBS);
    expect(jobs[0]?.id).toBe(`j${String(MAX_TRACKED_JOBS + 2)}`);
    expect(jobs.some(({ id }) => id === "j0")).toBe(false);
  });

  it("removes one job and leaves the others", () => {
    addTrackedJob(sessionStorage, "u1", job("j1"));
    addTrackedJob(sessionStorage, "u1", job("j2"));

    expect(removeTrackedJob(sessionStorage, "u1", "j1").map(({ id }) => id)).toEqual(["j2"]);
    expect(readTrackedJobs(sessionStorage, "u1").map(({ id }) => id)).toEqual(["j2"]);
  });

  it("reads nothing from content that is not a list of jobs", () => {
    sessionStorage.setItem("trading:jobs:u1", "{not json");
    expect(readTrackedJobs(sessionStorage, "u1")).toEqual([]);

    sessionStorage.setItem("trading:jobs:u1", JSON.stringify({ id: "j1" }));
    expect(readTrackedJobs(sessionStorage, "u1")).toEqual([]);
  });

  it("skips the entries that lack a field", () => {
    sessionStorage.setItem(
      "trading:jobs:u1",
      JSON.stringify([job("j1"), { id: "j2" }, { ...job("j3"), fileName: 7 }]),
    );

    expect(readTrackedJobs(sessionStorage, "u1").map(({ id }) => id)).toEqual(["j1"]);
  });

  it("keeps working when the storage refuses to write", () => {
    const refusing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => undefined,
    };

    expect(addTrackedJob(refusing, "u1", job("j1")).map(({ id }) => id)).toEqual(["j1"]);
  });
});
