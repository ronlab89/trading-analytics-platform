import { createContext, use, type ReactNode } from "react";
import type { SessionService } from "./session-service";

const SessionServiceContext = createContext<SessionService | undefined>(undefined);

interface SessionServiceProviderProps {
  service: SessionService;
  children: ReactNode;
}

/** Hands the one `SessionService` of the app to the hooks, so a test can swap it. */
export function SessionServiceProvider({ service, children }: SessionServiceProviderProps) {
  return <SessionServiceContext value={service}>{children}</SessionServiceContext>;
}

export function useSessionService(): SessionService {
  const service = use(SessionServiceContext);
  if (!service) {
    throw new Error("useSessionService must be used inside a SessionServiceProvider");
  }
  return service;
}
