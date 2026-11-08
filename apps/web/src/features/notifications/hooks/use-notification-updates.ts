import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { NotificationResponse } from "@trading/contracts";
import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";
import { notificationKeys } from "@/features/dashboard/hooks/use-notifications";
import { useRealtimeClient } from "@/realtime/realtime-client-provider";

/**
 * Reads the notifications again, because the event only says which one was created, and tells the
 * user about the new one when it warns or fails. The id of the toast is the id of the notification,
 * so the same one is never announced twice. Information and success only move the count.
 */
async function announceArrival(queryClient: QueryClient, notificationId: string) {
  await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  const arrived = queryClient
    .getQueryData<readonly NotificationResponse[]>(notificationKeys.all)
    ?.find(({ id }) => id === notificationId);
  if (arrived?.readAt !== null) return;

  const options = { id: arrived.id, description: arrived.message };
  if (arrived.severity === "WARNING") toast.warning(arrived.title, options);
  if (arrived.severity === "ERROR") toast.error(arrived.title, options);
}

/**
 * Keeps the notifications live: it listens to the notifications channel of the user while the
 * component is mounted, and every `NOTIFICATION_CREATED` reads the list again and announces the new
 * notification. A triggered alert comes with its own `NOTIFICATION_CREATED`, so `ALERT_TRIGGERED` is
 * not listened to, or the user would be told twice.
 */
export function useNotificationUpdates(): void {
  const client = useRealtimeClient();
  const queryClient = useQueryClient();
  const subscribe = useEffectEvent(() =>
    client.subscribe({ kind: "notifications" }, (event) => {
      if (event.type === "NOTIFICATION_CREATED") {
        void announceArrival(queryClient, event.payload.notificationId);
      }
    }),
  );

  useEffect(() => subscribe(), [client]);
}
