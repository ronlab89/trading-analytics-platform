import { useMutation, useQueryClient } from "@tanstack/react-query";
import { alertOperations } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { alertKeys } from "./use-alerts";

const deleteAlertOperation = findOperation(alertOperations, "deleteAlert");

/** Deletes an alert, which stops notifying the user, and refreshes the list. */
export function useDeleteAlert() {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["alerts", "delete"],
    mutationFn: async (alertId: string) => {
      await client.call(deleteAlertOperation, { params: { alertId } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertKeys.all });
    },
  });
}
