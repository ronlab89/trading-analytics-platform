import { useQueries } from "@tanstack/react-query";
import type { JobResponse } from "@trading/contracts";
import { useEffect } from "react";
import { ApiError } from "@/api/trading-client";
import { useTradingClient } from "@/api/trading-client-provider";
import { isJobFinished } from "../lib/job-state";
import type { TrackedJob } from "../lib/job-registry";
import { JOB_POLL_MS, jobKeys, readJob } from "./use-job";
import { useTrackedJobs } from "./use-tracked-jobs";

export interface TrackedJobState {
  tracked: TrackedJob;
  /** Undefined until the first read answers, and when the read failed. */
  job: JobResponse | undefined;
  isError: boolean;
}

/**
 * Every job this device started, each with the job as the API has it now. A job that has not
 * finished is read again every two seconds, one that has is read once. The Activity screen shows
 * the list while the import dialog may be closed, so this does not depend on the socket. A job the
 * API says does not exist (404) is dropped from the registry; any other failure keeps it, since
 * the next read may work.
 */
export function useTrackedJobStates(): TrackedJobState[] {
  const client = useTradingClient();
  const { jobs, forget } = useTrackedJobs();

  const results = useQueries({
    queries: jobs.map(({ id }) => ({
      queryKey: jobKeys.detail(id),
      queryFn: () => readJob(client, id),
      refetchInterval: (query: { state: { data: JobResponse | undefined } }) => {
        const job = query.state.data;
        return job !== undefined && isJobFinished(job) ? false : JOB_POLL_MS;
      },
    })),
  });

  const gone = jobs.filter((_, index) => {
    const error = results[index]?.error;
    return error instanceof ApiError && error.status === 404;
  });
  const goneIds = gone.map(({ id }) => id).join(",");
  useEffect(() => {
    if (goneIds === "") return;
    goneIds.split(",").forEach(forget);
  }, [goneIds, forget]);

  return jobs.map((tracked, index) => ({
    tracked,
    job: results[index]?.data,
    isError: results[index]?.isError ?? false,
  }));
}
