import { Navigate, Outlet, useLocation } from "react-router";
import { useSessionStatus } from "@/hooks/use-session";
import { SessionRestoring } from "./session-restoring";

/**
 * Layout route for the private pages. It waits while the first refresh answers, so the
 * login never flashes for a user who still has a session, and it sends everyone else
 * to the login with the page they asked for.
 */
export function RequireAuth() {
  const status = useSessionStatus();
  const location = useLocation();

  if (status === "unknown") {
    return <SessionRestoring />;
  }
  if (status === "anonymous") {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <Outlet />;
}
