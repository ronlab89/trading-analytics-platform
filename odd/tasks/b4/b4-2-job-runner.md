# B4.2 Job runner and state machine

Source: roadmap B4; ADR-008 points 5, 6, 7 and Deferred detail (racing transitions, timeout per attempt); ADR-006 shutdown. Depends on: B4.1. Branch: `feat/b4-2-job-runner`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/application/src/**
apps/api/src/lifecycle/**
apps/api/src/logging/**
apps/api/src/composition.ts
odd/tasks/b4/**

## Specs

- S1 A `JobService` creates, cancels and retries jobs; a request the state does not allow is a conflict and changes nothing.
- S2 An in-process runner picks `QUEUED` jobs, runs the two stages with progress and never runs one job twice.
- S3 On startup every `PROCESSING` job becomes `FAILED` with reason `INTERRUPTED` and every `QUEUED` job resumes; a job past its deadline is handled on startup.
- S4 The timeout applies while `QUEUED` or validating, per attempt from when the job was queued, never during apply.
- S5 The runner joins the B3 shutdown sequence: it stops taking jobs and leaves no job silently `PROCESSING`.
- S6 Job lifecycle events go through the logger (`job.queued`, `job.started`, `job.completed`, `job.failed`, `job.cancelled`, `job.timed_out`) with a `jobId` field.

## Tasks

- [x] T1 `JobService`: create, get, cancel and retry (`transaction:create` for writes, `transaction:read` for get, ownership on the job), state rules from the domain, tested with a compare-and-set fake repository.
- [x] T2 Runner loop, stages, progress and the timeout, tested with fake timers. `JobHandler` (`validate`, `apply`) is the seam B4.3 fills; the apply completes the job through `context.complete` inside its own unit of work.
- [x] T3 Startup recovery and the shutdown step. Recovery runs inside `start()` before the first claim (`PROCESSING` becomes `FAILED`/`INTERRUPTED`, `QUEUED` resumes, one past its deadline times out); `stop()` gives the job in flight a 5 s grace and then marks it interrupted. `createJobsShutdownStep` is in `apps/api/src/lifecycle/jobs-step.ts`; registering it and starting the runner in `index.ts` waits for the CSV handler in B4.3.
- [x] T4 Job lifecycle log events and the `LOG_EVENTS` registry. The names live in `JOB_EVENTS` (application), `LOG_EVENTS` references them; a retry logs `job.queued` with the new `attempt`; progress is not logged.

## Done when

State-transition tests cover failure, timeout, retry and cancel, and a racing resume and enqueue runs the job once.

## Risk

Item 4 (async ordering: compare-and-set transitions, startup resume, shutdown). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test.

## Log
