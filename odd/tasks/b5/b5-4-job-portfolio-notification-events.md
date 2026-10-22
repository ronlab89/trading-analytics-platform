# B5.4 Job, portfolio and notification events

Source: roadmap B5; ADR-007 points 6, 15 and 17; ADR-008 point 11; `08-realtime-spec.md` §18, §20, §21, §29. Depends on: B5.3. Branch: `feat/b5-4-job-portfolio-notification-events`.

Working rules: tiny tasks, each approved by the user before any edit (or delegated for the whole slice); no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/application/src/**
apps/api/src/composition.ts
apps/api/src/controllers/**
apps/api/src/realtime/**
odd/tasks/b5/**

## Specs

- S1 The job runner publishes `JOB_PROGRESS_UPDATED` while validating, `JOB_COMPLETED` after the apply commits and `JOB_FAILED` with its reason; `CANCELLED` and `TIMED_OUT` publish nothing (ADR-007 point 15).
- S2 `PORTFOLIO_UPDATED` is published only when holdings change, after the transaction creation or the import apply commits, never before.
- S3 `NOTIFICATION_CREATED` is published when a notification is created, on `notifications` for its owner (import results here; alerts in B5.7).
- S4 Publishing is best effort after the commit: a failure to publish never changes the HTTP response or the job and is logged, so realtime failure degrades to HTTP.
- S5 A job that finishes before `jobs:{jobId}` is subscribed is recovered from `GET /api/v1/jobs/:jobId`; the server keeps no replay buffer (ADR-007 point 5). Recorded as the answer to that Deferred detail.

## Tasks

- [x] T1 Job events from the runner, with the publisher as an optional dependency. `publishQuietly` (application) logs `realtime.publish_failed` and never propagates; the runner publishes progress, completion and failure after each committed change.
- [ ] T2 `PORTFOLIO_UPDATED` after `createTransaction` and after the import apply.
- [ ] T3 `NOTIFICATION_CREATED` from the notification creation path.
- [ ] T4 Publish failures are caught, logged and never propagate; tests with a publisher that throws.

## Done when

Each event is published once, after the commit, to the right channel, and a throwing publisher changes no response, job state or stored row; existing behavior without a publisher is unchanged.

## Risk

Item 3 (existing services gain an optional dependency; additive) and item 4 (publish ordering after commit). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test.

## Log
