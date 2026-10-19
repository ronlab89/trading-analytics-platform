# B3.3 Security events, defensive-read log and analytics timing

Source: roadmap B3 (`docs/BACKEND-ROADMAP.md`); ADR-009 points 8 and 9; `docs/13-observability-spec.md` §26, §44, §52; `docs/09-security-spec.md` §50, §51; `docs/PROGRESS.md` §7. Depends on: B3.1, B3.2. Branch: `feat/b3-3-security-events`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts. Where the `changes` defensive read and the analytics series reconstruction live is verified at T1; edit surfaces are widened with the user's approval if they fall outside the list.

## Allowed edit surfaces

packages/application/src/**
apps/api/src/**
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

- [ ] T1 Verify where login, refresh, logout, `assertPermission`, the `changes` read and the series reconstruction live, and how each reaches the `Logger`.
- [ ] T2 Login events, with tests on fields and on the absence of secrets.
- [ ] T3 Refresh reuse and logout events.
- [ ] T4 `authz.denied`.
- [ ] T5 The skipped-`changes` entry and the series timing.
- [ ] T6 Reconcile `09-security-spec.md` §50 and `13-observability-spec.md` §44 for what landed.

## Done when

Each security event is emitted with its level and fields and never with a secret; a skipped `changes` entry and a slow series reconstruction leave a log line.

## Risk

Items 2 (security: audit trail, no secret leaks) and 6 (assertions on log output must catch a regression).

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B3 plan approved by the user on 2026-10-19.
