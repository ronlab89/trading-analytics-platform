import { presentLogin } from "@trading/contracts";
import { UserRole } from "@trading/domain";
import { ApiError } from "@/api/trading-client";
import type { HandlerContext, HandlerRegistry } from "./handler";

const SESSION_MINUTES = 15;
const ACCESS_TOKEN = "demo-access-token";

/**
 * The role a demo sign in asks for, written in the email: `viewer@demo.example`, `trader@demo.example`
 * or `admin@demo.example`. Anything else signs in as the trader.
 */
export function roleOfDemoEmail(email: string): UserRole {
  const name = email.split("@")[0]?.toLowerCase();
  if (name === "viewer") return UserRole.VIEWER;
  if (name === "admin") return UserRole.ADMIN;
  return UserRole.TRADER;
}

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
    login: ({ body }) => {
      composition.setRole(roleOfDemoEmail((body as { email: string }).email));
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
