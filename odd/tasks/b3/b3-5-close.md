# B3.5 Docs and close

Source: roadmap B3 (`docs/BACKEND-ROADMAP.md`); `docs/13-observability-spec.md` §36, §74, §75; ADR-009. Depends on: B3.1 to B3.4. Branch: `docs/close-b3`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

docs/**
odd/tasks/b3/**

## Specs

- S1 Every `Planned (B3)` mark in `docs/` is checked against the code and flipped to `Implemented` with its block reference; B4 and B5 marks stay.
- S2 The B3 items of the `13-observability-spec.md` §74 checklist are checked, and the local observability workflow, log levels and troubleshooting workflow (§36) are documented.
- S3 A reproduced failure answers the questions of `13-observability-spec.md` §75 that B3 owns (1, 2, 3, 4, 5 and 8), recorded as the review result.
- S4 The ADR-009 header no longer says `auth.logout` lands in B2; the event landed in B3.
- S5 The roadmap status row and `PROGRESS.md` say B3 is done and B4 is next.

## Tasks

- [x] T1 Reproduce one failure locally and answer the §75 questions from the logs; record the result. The reproduction and the answers are in the Log.
- [x] T2 Flip the `Planned (B3)` marks after checking each against the code. All were flipped except the one of `13-observability-spec.md` §67, which T3 closed with the documentation it describes.
- [x] T3 Check the §74 items and write the workflow, levels and troubleshooting docs.
- [x] T4 Fix the ADR-009 header, close B3 in the roadmap and PROGRESS.

## Done when

The §75 questions owned by B3 are answerable from a reproduced failure, and no `Planned (B3)` mark is stale.

## Risk

None (documentation only), unless the review finds a defect, which becomes its own slice.

## Verification

pnpm docs:check.

## Log

- Created from the B3 plan approved by the user on 2026-10-19.
- 2026-10-20: the user delegated the whole slice (same terms as B3.4): Claude runs T1 to T4 one by one, commits after each, approves its own recommendations, and hands over only the push and `gh pr create`.
- 2026-10-20: T1, reproduced failure. The API ran for real (`tsx src/index.ts`, `NODE_ENV=production`, `LOG_LEVEL=debug`, port 7101) with `DATABASE_URL` pointing at a closed port (127.0.0.1:1), so the real Postgres was not touched. Requests: `GET /health/ready`, `POST /api/v1/auth/login` with a valid body, the same with an invalid body, and `GET /nope`. The log lines are JSON on stdout. The failing request is the login that needs the database (request `1b863161-a986-4237-ae93-853ff4f6eda3`, response 503 `DEPENDENCY_ERROR`). Answers to the §75 questions B3 owns:
  - 1 What operation failed: `event: "http.request.failed"` and the `http.request.completed` entry of the same request give `method: "POST"`, `path: "/api/v1/auth/login"`, `status: 503`.
  - 2 Which request: the `requestId` is the `X-Request-ID` response header, the `requestId` of the error body and the field of both log entries.
  - 3 Which layer: the `stack` of the `error`-level entry reads, from the top, `PrismaUserRepository.getByEmail` (repository), `login` in `auth.service.ts` (service), `loginHandler` in `auth.controller.ts` (controller). No `source` field exists by decision (ADR-009 point 3).
  - 4 What type: `errorCategory: "DEPENDENCY_ERROR"` (the same value as the body `code`) and `errorName: "PrismaClientInitializationError"`.
  - 5 Expected or not: `error` level with a stack for the dependency failure; the invalid body was `warn` (`VALIDATION_ERROR`) and the unknown route `info` (`NOT_FOUND`).
  - 8 Duration: `durationMs: 2090` on `http.request.completed`, written at `warn` because it passed `SLOW_REQUEST_THRESHOLD_MS` (500). `GET /health/ready` logged `health.database.unavailable` at `error` with `errorName` only, then the completed entry (2054 ms, `warn`).
  - Also seen: `app.startup.started` and `app.startup.completed` with the port; no `auth.login.failed` entry, as it only follows a 401.
  - Finding (advisory, no fix in this slice): the `message` of the unexpected-error entry is the driver message, and Prisma puts the database host and port in it (`Can't reach database server at 127.0.0.1:1`). It carries no password, but it is a connection target in the log. `09-security-spec.md` §49 already says the error message is not filtered; the real redaction decision (ADR-009 point 4) is a list of field names, not message text. The stack also holds absolute file paths, which is fine for a local log. To record in `09-security-spec.md` §49 in T3 and to reconsider in B7 before any hosted log.
- 2026-10-20: T3 decisions (approved by Claude under the delegation). The written workflow, the log-level table and the troubleshooting table live in `13-observability-spec.md` §66, with §36 corrected, because B3.5 may edit `docs/` only and `README.md` is outside it (the README entries stay with T5.2 of `14-deployment-spec.md`). The B3 items of §74 are checked against tests that exist: events, redaction, request context, request logger, correlation, error handler, security events, shutdown and the health routes. The unchecked ones belong to B4, B5, the frontend stage or are `Deferred`.
- 2026-10-20: T4 done. The roadmap header, status and B3 row, and the PROGRESS next-step paragraph, env paragraph and shutdown debt line now say B3 is done. The ADR-009 header was fixed in T2. `pnpm docs:check` passed.
