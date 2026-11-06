import { presentLogin } from "@trading/contracts";
import { ApiError } from "@/api/trading-client";
import type { HandlerContext, HandlerRegistry } from "./handler";

const SESSION_MINUTES = 15;
const ACCESS_TOKEN = "demo-access-token";

/** Fake authentication: any login works, and there is no refresh cookie (ADR-012 point 4). */
export function createAuthHandlers({
  composition,
  session,
  clock,
}: HandlerContext): HandlerRegistry {
  function newSession() {
    return presentLogin({
      user: composition.user,
      accessToken: ACCESS_TOKEN,
      expiresAt: new Date(clock.now().getTime() + SESSION_MINUTES * 60_000),
    });
  }

  return {
    login: () => {
      session.signedIn = true;
      return Promise.resolve({ data: newSession() });
    },
    refreshSession: () => {
      if (!session.signedIn) throw new ApiError("UNAUTHORIZED", "There is no session.", 401);
      return Promise.resolve({ data: newSession() });
    },
    logout: () => {
      session.signedIn = false;
      return Promise.resolve(undefined);
    },
    getCurrentUser: () => Promise.resolve({ data: { user: composition.user } }),
  };
}
