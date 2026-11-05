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

const markAllNotificationsReadOperation = findOperation(
  notificationOperations,
  "markAllNotificationsRead",
);

/** Marks every notification as read, with the same optimistic change and rollback as one. */
export function useMarkAllNotificationsRead() {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, undefined, OptimisticReadContext>({
    mutationKey: ["notifications", "read-all"],
    mutationFn: () => client.call(markAllNotificationsReadOperation),
    onMutate: () =>
      applyOptimisticRead(queryClient, (list) =>
        markNotificationsRead(list, new Date().toISOString()),
      ),
    onError: (_error, _variables, context) => {
      rollbackOptimisticRead(queryClient, context);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
