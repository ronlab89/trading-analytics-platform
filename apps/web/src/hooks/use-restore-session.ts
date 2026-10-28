import { useEffect } from "react";
import { useSessionService } from "@/services/session/session-provider";
import { useSessionStatus } from "./use-session";

/**
 * Signs in again from the refresh cookie when the app loads. The status leaves `unknown`
 * once the first answer arrives, so it runs once; StrictMode's second effect joins the
 * same request because the service shares the refresh in flight.
 */
export function useRestoreSession() {
  const session = useSessionService();
  const status = useSessionStatus();

  useEffect(() => {
    if (status === "unknown") {
      void session.restore();
    }
  }, [session, status]);
}
