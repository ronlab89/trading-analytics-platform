import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  alertOperations,
  type AlertResponse,
  type UpdateAlertRequestBody,
} from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { alertKeys } from "./use-alerts";

const updateAlertOperation = findOperation(alertOperations, "updateAlert");

interface UpdateAlertInput {
  alertId: string;
  body: UpdateAlertRequestBody;
}

/**
 * Changes the condition, the threshold or whether an alert is enabled (what it watches is fixed
 * after creation) and refreshes the list. Pausing and resuming an alert is this with `enabled`.
 */
export function useUpdateAlert() {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["alerts", "update"],
    mutationFn: async ({ alertId, body }: UpdateAlertInput) => {
      const { data } = (await client.call(updateAlertOperation, {
        params: { alertId },
        body,
      })) as { data: AlertResponse };
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertKeys.all });
    },
  });
}
