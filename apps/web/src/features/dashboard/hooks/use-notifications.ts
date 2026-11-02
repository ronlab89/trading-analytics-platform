import { useQuery } from "@tanstack/react-query";
import { notificationOperations, type NotificationResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const listNotificationsOperation = findOperation(notificationOperations, "listNotifications");

/** Query keys of the notifications, so a screen that changes them can invalidate the list. */
export const notificationKeys = {
  all: ["notifications"] as const,
};

/**
 * The notifications of the user (the API does not promise an order): the alerts, the news and the
 * completed events the dashboard shows under "Requiere atención". They belong to the user, not to
 * a portfolio, and the API does not paginate them.
 */
export function useNotifications() {
  const client = useTradingClient();

  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: async () => {
      const { data } = (await client.call(listNotificationsOperation)) as {
        data: NotificationResponse[];
      };
      return data;
    },
  });
}
