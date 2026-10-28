import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser reports a connection; it says "offline" reliably, "online" only roughly. */
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => window.navigator.onLine,
    () => true,
  );
}
