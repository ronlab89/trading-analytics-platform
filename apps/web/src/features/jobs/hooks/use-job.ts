import { useQuery, useQueryClient } from "@tanstack/react-query";
import { transactionOperations, type JobResponse } from "@trading/contracts";
import { useEffect, useEffectEvent } from "react";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { useConnectionState, useRealtimeClient } from "@/realtime/realtime-client-provider";
import { isJobFinished } from "../lib/job-state";

const getJobOperation = findOperation(transactionOperations, "getJob");

/** How often a job that is not finished is read again while the socket is not delivering. */
export const JOB_POLL_MS = 2000;

/** Query keys of the jobs, so an action on one can refresh or replace it. */
export const jobKeys = {
  detail: (jobId: string) => ["jobs", jobId] as const,
};

/**
 * One job, read over HTTP. The events of its channel carry only the status and the progress, not
 * the stage that tells Validating from Applying, so each one marks the job as stale and it is read
 * again. While the socket is not connected a job that has not finished is polled instead, so the
 * progress keeps moving without it. It reads nothing while there is no job.
 */
export function useJob(jobId: string | undefined) {
  const client = useTradingClient();
  const realtime = useRealtimeClient();
  const queryClient = useQueryClient();
  const connection = useConnectionState();

  const subscribe = useEffectEvent(() => {
    if (jobId === undefined) return undefined;
    return realtime.subscribe({ kind: "jobs", jobId }, (event) => {
      if (
        event.type === "JOB_PROGRESS_UPDATED" ||
        event.type === "JOB_COMPLETED" ||
        event.type === "JOB_FAILED"
      ) {
        void queryClient.invalidateQueries({ queryKey: jobKeys.detail(event.payload.jobId) });
      }
    });
  });
  useEffect(() => subscribe(), [realtime, jobId]);

  return useQuery({
    queryKey: jobKeys.detail(jobId ?? ""),
    enabled: jobId !== undefined,
    queryFn: async () => {
      const { data } = (await client.call(getJobOperation, {
        params: { jobId: jobId ?? "" },
      })) as { data: JobResponse };
      return data;
    },
    refetchInterval: (query) => {
      const job = query.state.data;
      if (connection === "connected" || (job !== undefined && isJobFinished(job))) return false;
      return JOB_POLL_MS;
    },
  });
}
