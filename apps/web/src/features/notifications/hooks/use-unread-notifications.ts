import { useMemo } from "react";
import type { Unread } from "@/components/shell/notification-button";
import { useNotifications } from "@/features/dashboard/hooks/use-notifications";
import { summarizeUnread } from "../lib/summarize-unread";

/**
 * What the shell shows of the notifications: the state of the bell (nothing, a count, or a dot
 * while the count is unknown because the list is loading or failed) and how many alerts the status
 * bar counts. It reads the same query as the dashboard and Activity, so it costs no extra request.
 */
export function useUnreadNotifications(): { unread: Unread; alerts: number } {
  const { data } = useNotifications();

  return useMemo(() => {
    // Without data the query is loading or failed: either way the count is not known.
    if (data === undefined) return { unread: { kind: "dot" }, alerts: 0 };
    const summary = summarizeUnread(data);
    return {
      unread: summary.unread === 0 ? { kind: "none" } : { kind: "count", count: summary.unread },
      alerts: summary.alerts,
    };
  }, [data]);
}
