import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionOperations, type JobResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { jobKeys } from "./use-job";

const cancelJobOperation = findOperation(transactionOperations, "cancelJob");
const retryJobOperation = findOperation(transactionOperations, "retryJob");

function useJobAction(action: "cancel" | "retry", jobId: string) {
  const client = useTradingClient();
  const queryClient = useQueryClient();
  const operation = action === "cancel" ? cancelJobOperation : retryJobOperation;

  return useMutation({
    mutationKey: ["jobs", action, jobId],
    mutationFn: async () => {
      const { data } = (await client.call(operation, { params: { jobId } })) as {
        data: JobResponse;
      };
      return data;
    },
    // The answer is the job as it is now, so it replaces the cached one without another read.
    onSuccess: (job) => {
      queryClient.setQueryData(jobKeys.detail(jobId), job);
    },
  });
}

/** Cancels a job that has not started applying; the API answers 409 to one that cannot be. */
export function useCancelJob(jobId: string) {
  return useJobAction("cancel", jobId);
}

/** Queues a timed-out, cancelled or recoverably failed job again; any other answers 409. */
export function useRetryJob(jobId: string) {
  return useJobAction("retry", jobId);
}
