import { useCallback, useSyncExternalStore } from "react";
import { useSessionStore } from "@/stores/session-store";
import {
  addTrackedJob,
  readTrackedJobs,
  removeTrackedJob,
  type TrackedJob,
} from "../lib/job-registry";

const NO_JOBS: TrackedJob[] = [];

// The registry lives in `sessionStorage`; this keeps one array per user between reads, so React sees
// the same value until the registry changes, and tells every reader when it does.
const cache = new Map<string, TrackedJob[]>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function jobsOf(userId: string): TrackedJob[] {
  let jobs = cache.get(userId);
  if (jobs === undefined) {
    jobs = readTrackedJobs(sessionStorage, userId);
    cache.set(userId, jobs);
  }
  return jobs;
}

function publish(userId: string, jobs: TrackedJob[]) {
  cache.set(userId, jobs);
  listeners.forEach((listener) => {
    listener();
  });
}

/**
 * The jobs this device started for the signed-in user, newest first. The API has no list of jobs,
 * so this is what the Activity screen can show; a job from another device or another tab is not
 * here. Without a signed-in user there is nothing to keep and `track` does nothing.
 */
export function useTrackedJobs() {
  const userId = useSessionStore((state) => state.user?.id);
  const jobs = useSyncExternalStore(subscribe, () =>
    userId === undefined ? NO_JOBS : jobsOf(userId),
  );

  const track = useCallback(
    (job: TrackedJob) => {
      if (userId !== undefined) publish(userId, addTrackedJob(sessionStorage, userId, job));
    },
    [userId],
  );
  const forget = useCallback(
    (jobId: string) => {
      if (userId !== undefined) publish(userId, removeTrackedJob(sessionStorage, userId, jobId));
    },
    [userId],
  );

  return { jobs, track, forget };
}
