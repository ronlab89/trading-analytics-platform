import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  alertOperations,
  type AlertResponse,
  type CreateAlertRequestBody,
} from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { alertKeys } from "./use-alerts";

const createAlertOperation = findOperation(alertOperations, "createAlert");

/**
 * Creates an alert and refreshes the list. It sends no `Idempotency-Key`: the API takes it only on
 * transactions and imports. A condition that is already true when the alert is created starts
 * disarmed on the server, so it fires the next time the price crosses the threshold again.
 */
export function useCreateAlert() {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["alerts", "create"],
    mutationFn: async (body: CreateAlertRequestBody) => {
      const { data } = (await client.call(createAlertOperation, { body })) as {
        data: AlertResponse;
      };
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertKeys.all });
    },
  });
}
