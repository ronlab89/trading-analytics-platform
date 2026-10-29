import type { LoginResponse } from "@trading/contracts";
import { create } from "zustand";

export type SessionUser = LoginResponse["user"];

interface SessionState {
  /** `unknown` until the first refresh answers; the routes wait instead of flashing the login. */
  status: "unknown" | "authenticated" | "anonymous";
  user: SessionUser | undefined;
  /** In memory only: never in `localStorage` or `sessionStorage` (ADR-005 point 4). */
  accessToken: string | undefined;
  /** True when a session that existed ended because the API stopped accepting it. */
  expired: boolean;
  signIn: (response: LoginResponse) => void;
  signOut: (options?: { expired?: boolean }) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: "unknown",
  user: undefined,
  accessToken: undefined,
  expired: false,
  signIn: ({ user, session }) => {
    set({ status: "authenticated", user, accessToken: session.accessToken, expired: false });
  },
  signOut: ({ expired = false } = {}) => {
    set({ status: "anonymous", user: undefined, accessToken: undefined, expired });
  },
}));

/** What the HTTP client reads on every authenticated request. */
export function getAccessToken(): string | undefined {
  return useSessionStore.getState().accessToken;
}
