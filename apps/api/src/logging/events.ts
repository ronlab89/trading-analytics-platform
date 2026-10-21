import { JOB_EVENTS, SERIES_BUILT_EVENT } from "@trading/application";

/**
 * Stable dotted event names of the API log (ADR-009 points 3, 6, 9 and 11;
 * 13-observability-spec.md §8). The job names come from the application,
 * which writes them; realtime and simulator names are added by B5.
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
  appShutdownStepFailed: "app.shutdown.step_failed",
  jobQueued: JOB_EVENTS.queued,
  jobStarted: JOB_EVENTS.started,
  jobCompleted: JOB_EVENTS.completed,
  jobFailed: JOB_EVENTS.failed,
  jobCancelled: JOB_EVENTS.cancelled,
  jobTimedOut: JOB_EVENTS.timedOut,
} as const;
