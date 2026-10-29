import { useSessionStore } from "@/stores/session-store";

/** One selector per field, so a component re-renders only for what it reads. */
export function useSessionStatus() {
  return useSessionStore((state) => state.status);
}

export function useCurrentUser() {
  return useSessionStore((state) => state.user);
}

/** True when a session that existed ended because the API stopped accepting it. */
export function useSessionExpired() {
  return useSessionStore((state) => state.expired);
}
