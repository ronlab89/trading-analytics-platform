import { authOperations, type ApiOperation, type LoginResponse } from "@trading/contracts";
import { ApiError, type TradingClient } from "@/api/trading-client";
import { useSessionStore } from "@/stores/session-store";

function operation(operationId: string): ApiOperation {
  const found = authOperations.find((candidate) => candidate.operationId === operationId);
  if (!found) {
    throw new Error(`Unknown auth operation "${operationId}"`);
  }
  return found;
}

const loginOperation = operation("login");
const refreshOperation = operation("refreshSession");
const logoutOperation = operation("logout");

/** The API answers 401 or 403 when the refresh cookie is missing, expired or already rotated. */
function isRefusal(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export interface SessionService {
  login: (email: string, password: string) => Promise<void>;
  /** On load: signs in again from the refresh cookie, or settles as signed out. */
  restore: () => Promise<void>;
  /** Resolves `false` when the API no longer accepts the session; other failures reject. */
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
}

/** Login, refresh and logout over the API, keeping the result in the session store. */
export function createSessionService(client: TradingClient): SessionService {
  let inFlight: Promise<boolean> | undefined;

  async function refreshOnce(): Promise<boolean> {
    const hadSession = useSessionStore.getState().status === "authenticated";
    try {
      const { data } = (await client.call(refreshOperation)) as { data: LoginResponse };
      useSessionStore.getState().signIn(data);
      return true;
    } catch (error) {
      if (!isRefusal(error)) {
        throw error;
      }
      useSessionStore.getState().signOut({ expired: hadSession });
      return false;
    }
  }

  /** Parallel callers share one request: a second rotation would revoke the session (ADR-005). */
  function refresh(): Promise<boolean> {
    inFlight ??= refreshOnce().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  return {
    async login(email, password) {
      const { data } = (await client.call(loginOperation, { body: { email, password } })) as {
        data: LoginResponse;
      };
      useSessionStore.getState().signIn(data);
    },

    async restore() {
      try {
        await refresh();
      } catch {
        useSessionStore.getState().signOut();
      }
    },

    refresh,

    async logout() {
      try {
        await client.call(logoutOperation);
      } catch {
        // The cookie is the server's to clear; the browser forgets the user either way.
      }
      useSessionStore.getState().signOut();
    },
  };
}
