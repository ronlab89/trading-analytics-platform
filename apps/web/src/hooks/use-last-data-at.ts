import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/** When the data on screen last arrived: the newest answer any query has received, if any. */
export function useLastDataAt(): number | undefined {
  const cache = useQueryClient().getQueryCache();
  const newest = useSyncExternalStore(
    (listener) => cache.subscribe(listener),
    () => Math.max(0, ...cache.getAll().map((query) => query.state.dataUpdatedAt)),
  );
  return newest === 0 ? undefined : newest;
}
