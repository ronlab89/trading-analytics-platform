import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationOperations } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { notificationKeys } from "@/features/dashboard/hooks/use-notifications";
import { markNotificationsRead } from "../lib/mark-notifications-read";
import {
  applyOptimisticRead,
  rollbackOptimisticRead,
  type OptimisticReadContext,
} from "./optimistic-read";

const markNotificationReadOperation = findOperation(notificationOperations, "markNotificationRead");

/**
 * Marks one notification as read. The list shows it read at once, so the bell and the panel answer
 * the click; if the server refuses, the list goes back to how it was, and either way it is read
 * again, because the server is the one that knows.
 */
export function useMarkNotificationRead() {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string, OptimisticReadContext>({
    mutationKey: ["notifications", "read"],
    mutationFn: (notificationId) =>
      client.call(markNotificationReadOperation, { params: { notificationId } }),
    onMutate: (notificationId) =>
      applyOptimisticRead(queryClient, (list) =>
        markNotificationsRead(list, new Date().toISOString(), notificationId),
      ),
    onError: (_error, _notificationId, context) => {
      rollbackOptimisticRead(queryClient, context);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
