import { useQuery } from "@tanstack/react-query";
import { alertOperations, type AlertResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const listAlertsOperation = findOperation(alertOperations, "listAlerts");

/** Query keys of the alerts, so creating, changing or deleting one can refresh the list. */
export const alertKeys = {
  all: ["alerts"] as const,
};

/** The alerts of the signed-in user. They belong to the user, and the API sends the list whole. */
export function useAlerts() {
  const client = useTradingClient();

  return useQuery({
    queryKey: alertKeys.all,
    queryFn: async () => {
      const { data } = (await client.call(listAlertsOperation)) as { data: AlertResponse[] };
      return data;
    },
  });
}
