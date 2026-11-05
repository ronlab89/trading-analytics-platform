import type { QueryClient } from "@tanstack/react-query";
import type { NotificationResponse } from "@trading/contracts";
import { notificationKeys } from "@/features/dashboard/hooks/use-notifications";

export interface OptimisticReadContext {
  /** The list as it was before the change, to put back if the server refuses. */
  previous: readonly NotificationResponse[] | undefined;
}

/**
 * Shows a change to the notifications before the server confirms it: it stops any read in flight,
 * which would bring the old list back over the change, keeps the list as it was, and applies
 * `update` to it. A list that has not loaded has nothing to change.
 */
export async function applyOptimisticRead(
  queryClient: QueryClient,
  update: (notifications: readonly NotificationResponse[]) => readonly NotificationResponse[],
): Promise<OptimisticReadContext> {
  await queryClient.cancelQueries({ queryKey: notificationKeys.all });
  const previous = queryClient.getQueryData<readonly NotificationResponse[]>(notificationKeys.all);
  queryClient.setQueryData<readonly NotificationResponse[]>(notificationKeys.all, (list) =>
    list ? update(list) : list,
  );
  return { previous };
}

/** Puts the list back as it was when the server refused the change. */
export function rollbackOptimisticRead(
  queryClient: QueryClient,
  context: OptimisticReadContext | undefined,
): void {
  if (context?.previous === undefined) return;
  queryClient.setQueryData(notificationKeys.all, context.previous);
}
