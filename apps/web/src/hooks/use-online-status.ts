import { useReducer, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether the browser reports a connection; it says "offline" reliably, "online" only roughly.
 * `recheck` reads it again on demand, for a "Try again" that must not wait for the event.
 */
export function useOnlineStatus() {
  const [, recheck] = useReducer((count: number) => count + 1, 0);
  const online = useSyncExternalStore(
    subscribe,
    () => window.navigator.onLine,
    () => true,
  );

  return { online, recheck };
}
