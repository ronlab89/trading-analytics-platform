# B3.3 Security events, defensive-read log and analytics timing

Source: roadmap B3 (`docs/BACKEND-ROADMAP.md`); ADR-009 points 8 and 9; `docs/13-observability-spec.md` §26, §44, §52; `docs/09-security-spec.md` §50, §51; `docs/PROGRESS.md` §7. Depends on: B3.1, B3.2. Branch: `feat/b3-3-security-events`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts. Where the `changes` defensive read and the analytics series reconstruction live is verified at T1; edit surfaces are widened with the user's approval if they fall outside the list.

## Allowed edit surfaces

packages/application/src/**
apps/api/src/**
packages/database/src/mappers/**
docs/09-security-spec.md
docs/13-observability-spec.md
docs/PROGRESS.md

## Specs

- S1 `auth.login.succeeded` and `auth.login.failed`; failures carry the same fields whatever the cause (no unknown-email vs wrong-password value) and no IP or user agent. Failures log at `warn`. (ADR-009 points 6 and 9; approved default 7, 2026-10-19)
- S2 `auth.refresh.reuse_detected`; other refresh failures have no dedicated event and stay ordinary 401 request logs. (ADR-009 point 9)
- S3 `auth.logout` at `info` with `userId` only; the logout service returns the `userId`. (ADR-009 point 9)
- S4 `authz.denied` on role checks. (ADR-009 point 9)
- S5 No password, token, cookie or `Authorization` value in any of these entries (tested). (ADR-009 point 4)
- S6 One log entry when a stored scenario `changes` entry is skipped by the defensive read, so corruption can surface. (decided 2026-10-08, `PROGRESS.md` §7)
- S7 The analytics series reconstruction is timed through the `Clock` port and logged at `debug` with `durationMs`, raised to `warn` above `SLOW_REQUEST_THRESHOLD_MS`; no shared timer helper. (ADR-009 point 8; approved default 6)

## Tasks

- [x] T1 Verify where login, refresh, logout, `assertPermission`, the `changes` read and the series reconstruction live, and how each reaches the `Logger`. Findings and the approved placement are in the Log.
- [x] T2 Login events, with tests on fields and on the absence of secrets. Commits: `c3f436e`, `df23e32` (event ordered after the response).
- [x] T3 Refresh reuse and logout events. Commits: `df23e32` (logout), `0471d6b` (rotated-token test), `2ac3d89` (reuse).
- [x] T4 `authz.denied`. Commits: `4c8c114`, `8f4030f` (route test).
- [x] T5 The skipped-`changes` entry (`0cac7fc`) and the series timing (`9623746`).
- [x] T6 Reconcile `09-security-spec.md` §50 and `13-observability-spec.md` §44 for what landed. Commit: `8e90c5c`.

## Done when

Each security event is emitted with its level and fields and never with a secret; a skipped `changes` entry and a slow series reconstruction leave a log line.

## Risk

Items 2 (security: audit trail, no secret leaks) and 6 (assertions on log output must catch a regression).

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B3 plan approved by the user on 2026-10-19.
- 2026-10-19: T1 findings (read-only, no code touched). None of these reach a `Logger` today.
  - Login: `login()` in `apps/api/src/services/auth.service.ts`, a module function over singleton repositories; the controller `loginHandler` has `req.logger`. Success knows `result.user.id`; failure is one generic `AppError` 401.
  - Refresh: `createRefreshService` in `services/refresh.service.ts` (options object, injectable). Reuse is the `!insideWindow` branch of `replay()`, where `revokeFamily` runs. Wired in `services/session.service.ts` with `systemClock`.
  - Logout: `createLogoutService` returns `void`; the `session.userId` is available there (S3 asks it to return it). Wired in `session.service.ts`; the controller is `logoutHandler`.
  - `authz.denied`: `assertPermission` in `packages/application/src/permissions.ts` is a pure function with no logger, called from 60 sites in 18 services; it throws `ForbiddenError` with the permission only inside the message text.
  - Skipped `changes`: `toDomainChanges` in `packages/database/src/mappers/scenario-mapper.ts`, a pure function; `packages/database` is outside this slice's edit surfaces.
  - Series: `buildPortfolioSeries` in `packages/application/src/portfolio-series.ts`, which already receives `clock` in its dependencies.
- 2026-10-19: the user approved the placement ("Si es lo recomendado si lo apruebo"): login and logout events in `loginHandler` and `logoutHandler` through `req.logger` (the logout service returns the `userId`); refresh reuse through a `logger` option of `createRefreshService`, wired with a context-aware logger in `session.service.ts`; `authz.denied` in the error handler on `ForbiddenError`, with a new `permission` field set by `assertPermission`; the skipped `changes` entry through an optional callback of `toDomainChanges`; the series timing through an optional `logger` in the dependencies of `buildPortfolioSeries`. Edit surfaces widened to `packages/database/src/mappers/**`.
- 2026-10-20: slice closed. Native review of `df23e32..8e90c5c` (lenses `risk`, `reliability`; assessed high only by the `security` signal in a doc path): approved, authority acknowledged and burned. Advisory, non-blocking (R3): the `analytics.series.built`, refresh reuse and `scenario.changes.skipped` calls run inline, so a logger that throws would fail the request; no test covers it. Left as later work (a guard around the logger). Known untested wiring: `composition.ts` for the scenario callback and the series timing; refresh reuse has no route-level test (`session.service.ts` uses the global logger). Flaky risk: `auth.login-events.test.ts` takes about 4 s of the 5 s limit (bcrypt hashing).
