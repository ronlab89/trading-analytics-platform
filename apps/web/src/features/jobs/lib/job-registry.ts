/** A job this device started: the API has no list of jobs, so the browser keeps the ones it knows. */
export interface TrackedJob {
  id: string;
  portfolioId: string;
  fileName: string;
  /** An ISO timestamp. */
  startedAt: string;
}

/** The part of `Storage` the registry uses, so a test or another store can stand in. */
export type JobStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** How many jobs are kept; the oldest go first. */
export const MAX_TRACKED_JOBS = 20;

const keyOf = (userId: string) => `trading:jobs:${userId}`;

function isTrackedJob(value: unknown): value is TrackedJob {
  if (typeof value !== "object" || value === null) return false;
  const { id, portfolioId, fileName, startedAt } = value as Record<string, unknown>;
  return (
    typeof id === "string" &&
    typeof portfolioId === "string" &&
    typeof fileName === "string" &&
    typeof startedAt === "string"
  );
}

/** The jobs of a user, newest first. Content that is not a list of jobs reads as no jobs. */
export function readTrackedJobs(storage: JobStorage, userId: string): TrackedJob[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(keyOf(userId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isTrackedJob) : [];
  } catch {
    return [];
  }
}

function write(storage: JobStorage, userId: string, jobs: TrackedJob[]): TrackedJob[] {
  try {
    storage.setItem(keyOf(userId), JSON.stringify(jobs));
  } catch {
    // Storage that is full or switched off costs the list its memory, never the import itself.
  }
  return jobs;
}

/** Adds a job at the front, once, and keeps the newest `MAX_TRACKED_JOBS`. */
export function addTrackedJob(storage: JobStorage, userId: string, job: TrackedJob): TrackedJob[] {
  const others = readTrackedJobs(storage, userId).filter(({ id }) => id !== job.id);
  return write(storage, userId, [job, ...others].slice(0, MAX_TRACKED_JOBS));
}

export function removeTrackedJob(storage: JobStorage, userId: string, jobId: string): TrackedJob[] {
  return write(
    storage,
    userId,
    readTrackedJobs(storage, userId).filter(({ id }) => id !== jobId),
  );
}
