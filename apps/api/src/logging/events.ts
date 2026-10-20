import { SERIES_BUILT_EVENT } from "@trading/application";

/**
 * Stable dotted event names of the API log (ADR-009 points 3, 6, 9 and 11;
 * 13-observability-spec.md §8). Job, realtime and simulator names are added
 * by B4 and B5.
 */
export const LOG_EVENTS = {
  httpRequestCompleted: "http.request.completed",
  httpRequestFailed: "http.request.failed",
  healthDatabaseUnavailable: "health.database.unavailable",
  authLoginSucceeded: "auth.login.succeeded",
  authLoginFailed: "auth.login.failed",
  authRefreshReuseDetected: "auth.refresh.reuse_detected",
  authLogout: "auth.logout",
  authzDenied: "authz.denied",
  scenarioChangesSkipped: "scenario.changes.skipped",
  analyticsSeriesBuilt: SERIES_BUILT_EVENT,
  appStartupStarted: "app.startup.started",
  appStartupCompleted: "app.startup.completed",
  appShutdownStarted: "app.shutdown.started",
  appShutdownCompleted: "app.shutdown.completed",
} as const;
