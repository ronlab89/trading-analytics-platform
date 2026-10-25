# B7.6 Final security pass

Source: roadmap B7 (security checklist and final pass, decided 2026-10-08); `15-implementation-plan.md` §33; `14-deployment-spec.md` §78; ADR-006 point 9; ADR-009. Depends on: B7.1 to B7.4 (the pass runs over the finished stack). Branch: `docs/b7-6-security-pass`, then fix branches if a finding needs code.

Working rules: as B7.1. The pass reads code and tests, not the docs, as in B2.5.

## Allowed edit surfaces

docs/**
odd/tasks/b7/**

## Specs

- S1 The checklist of `15` §33 is walked over the whole backend, one row per area, each with the evidence (file, test or command) and a verdict: Meets, Meets with a note, or Does not meet.
- S2 The §78 areas are covered explicitly: secrets, CORS, headers, error exposure, health output, resource limits.
- S3 B2.5 covered sessions, roles, permissions and token handling; this pass does not repeat that review, it only links to it.
- S4 Every "Does not meet" becomes a finding with an owner: fixed in this block as its own small task, or recorded as `Deferred` with the reason.
- S5 The database recovery entry is decided: version 1 has none, because readiness is stateless (ADR-009); the decision is re-stated now that the healthcheck exists.
- S6 Backups are documented as not applicable to a local environment, not claimed (ADR-006 point 9).

## Tasks

- [x] T1 Walk §33 and §78 read-only and write the review table in this file.
- [x] T2 Present the findings; each becomes its own task (T4 to T6 below) with an owner.
- [x] T3 Docs: the recovery-entry decision, the backups statement, and the checklist ticked with evidence in `14`.
- [ ] T4 (F1) Raise the vulnerable dependencies to their patched versions and rerun the audit. Branch `fix/b7-6-hardening`, after this review is merged.
- [ ] T5 (F2) RED then GREEN: an API test that pins the security headers. Same branch.
- [ ] T6 (F3) `mem_limit: 512m` on the `api` service, measured with the smoke test and `docker stats`. Same branch.

## Review results

Read on 2026-10-25 from the code, the tests and commands that were run. Sessions, roles, permissions and token handling were reviewed in B2.5 (`odd/tasks/b2/b2-5-close.md`) and are linked, not repeated. Verdicts: Meets, Meets with a note, Does not meet, Deferred.

### `15` §33 (validation strategy)

| Area                  | Verdict                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication        | Meets                  | B2.5. Every route file applies `authenticate` except `auth` (login, refresh and logout are public by design; `me` is protected). `GET /api/v1/portfolios` without a token answered 401 with the error envelope in the in-process probe and in smoke step 2 (B7.4).                                                                                                                                                                                    |
| Authorization         | Meets                  | B2.5. `simulation:control` is ADMIN-only (`packages/application/src/permissions.ts:32,63`) and asserted in the service (`simulation-service.ts:49,54`).                                                                                                                                                                                                                                                                                               |
| Input validation      | Meets                  | 59 `validate(...)` calls over the route files. All 36 routes with a path parameter validate `params` (counted per file). JSON body limit 100 kB, CSV tokenizer (B4), WebSocket message schema (B5).                                                                                                                                                                                                                                                   |
| CORS                  | Meets                  | `apps/api/src/app.ts:77` takes `CORS_ORIGIN`; a request with `Origin: http://evil.example` got no `Access-Control-Allow-Origin` in the probe; `app.cors.test.ts`; `*` is rejected at startup.                                                                                                                                                                                                                                                         |
| Secrets               | Meets with a note      | `git ls-files`: only `.env.example` and `.env.test.example` are tracked, and `.gitignore` covers `.env`, `.env.local`, `.env.*.local`. `git grep` for secret-like literals outside tests, docs and the seed finds only a measurement script secret, the test fixture password and the public demo password of `smoke.mjs`. `JWT_SECRET` has no default and needs 32 characters; `DATABASE_URL` is validated (B7.1). Note: there is no secret scanner. |
| Rate limiting         | Meets                  | `middleware/rate-limit.ts`: 300 requests per 15 minutes for the API and 5 per 15 minutes for login; health routes sit before the limiter on purpose; realtime limits (B5).                                                                                                                                                                                                                                                                            |
| Resource limits       | Does not meet (F3)     | Met: JSON 100 kB, CSV 1 MiB (`IMPORT_MAX_BYTES`), page size at most 100, WebSocket inbound 64 KiB and outbound buffer 1 MiB. Missing: `docker-compose.yml` sets no memory limit, and NFR-054 asks for 512 MB.                                                                                                                                                                                                                                         |
| Error exposure        | Meets with a note      | `middleware/error-handler.ts:223-227` returns "An unexpected error occurred." for a 500 and a fixed message for a database 503; logs redact `password`, `authorization` and `cookie` (`logging/pino-logger.ts:12-32`). Note: the 404 echoes the method and path, and application errors (403, 404, 409) return their own message on purpose.                                                                                                          |
| File handling         | Meets                  | The only body besides JSON is `text/csv` through `express.text` with `IMPORT_MAX_BYTES` (`routes/jobs.routes.ts:21`). The API writes no file.                                                                                                                                                                                                                                                                                                         |
| Dependency security   | Does not meet (F1)     | `pnpm audit --prod --audit-level=high` reports 4 advisories (below). The lockfile and the frozen install in CI and in the image are in place.                                                                                                                                                                                                                                                                                                         |
| Security headers      | Meets with a note (F2) | In-process probe of `/health`, a 404 and a 401: `x-content-type-options: nosniff`, `strict-transport-security`, `x-frame-options: SAMEORIGIN`, a `default-src 'self'` policy, `cross-origin-opener-policy: same-origin`, `referrer-policy: no-referrer`, no `x-powered-by`. Note: no automated test pins these headers; only the docs route test reads the policy.                                                                                    |
| Runtime database role | Meets                  | Migration `20261010120000_add_runtime_role` (no superuser, `CREATE` revoked), `runtime-role.test.ts`, and the `full` profile connects the API as `trading_runtime` and migrates as the superuser (B7.3).                                                                                                                                                                                                                                              |

### `14` §78 (security checklist)

| Item                             | Verdict            | Evidence                                                                                                                                              |
| -------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| No secrets committed             | Meets with a note  | As Secrets above.                                                                                                                                     |
| Production JWT secret configured | Meets              | No default, 32 characters; the `full` profile reads it from `.env` and an empty value stops the API with a message (B7.3).                            |
| Database credentials protected   | Meets with a note  | The API uses the runtime role; PostgreSQL and the API publish on `127.0.0.1` only (B7.3). Note: the Compose fallback password is a known local value. |
| CORS restricted                  | Meets              | As CORS above.                                                                                                                                        |
| HTTPS enabled                    | Deferred           | No hosted backend (ADR-006 point 2).                                                                                                                  |
| Debug mode disabled              | Meets              | No debug switch; `LOG_LEVEL` defaults to `info` in production (`config/env.ts:8-12`) and Compose sets `NODE_ENV=production` for the API.              |
| Stack traces hidden              | Meets              | As Error exposure.                                                                                                                                    |
| Health output sanitized          | Meets              | `controllers/health.controller.ts`: fixed fields and `ok` or `unavailable`; the 503 body carries no error detail.                                     |
| Metrics restricted if exposed    | Meets              | Satisfied by absence: no metrics endpoint (ADR-009 point 10).                                                                                         |
| Admin operations protected       | Meets              | `simulation:control` as above.                                                                                                                        |
| Rate limits considered           | Meets              | As Rate limiting.                                                                                                                                     |
| Resource limits configured       | Does not meet (F3) | As Resource limits.                                                                                                                                   |
| Demo data isolated               | Deferred           | The demo is a frontend stage item (`Planned (FE)`).                                                                                                   |
| Dependencies reviewed            | Does not meet (F1) | As Dependency security.                                                                                                                               |

Other checks that were run: the API image runs as `node` with `TZ=UTC` and carries no tests or `.env` (B7.2); the image healthcheck probes `GET /health/ready`; a WebSocket client authenticates with its first message within a timeout, so there is no ambient credential to hijack and an `Origin` check adds nothing (note for the realtime spec).

### Findings

- F1 Dependencies, owner: fix task T4. `pnpm audit --prod --audit-level=high` found `proxy-addr` 2.0.7 (critical, GHSA-jqcg-44mw-7w3h; not reachable today because the API never sets `trust proxy`), `body-parser` 2.3.0 (high, GHSA-27r3-jxmh-p828; reachable through `express.json`), `zod` 4.6.5 (high, GHSA-mrhx-c7xc-m3w5; reachable through request validation) and `deepmerge-ts` 7.1.5 (high, GHSA-ggr8-5vv4-36mx; reached through the Prisma CLI config, not a request path). All four have patched versions. Recommendation: raise the ranges or the lockfile to the patched versions without a major bump, then rerun the audit and the suites.
- F2 No header test, owner: fix task T5. Recommendation: one API test that asserts the headers listed above on `/health` and on an error response.
- F3 No container memory limit, owner: fix task T6. Recommendation: set `mem_limit: 512m` on `api`, then run the smoke test and read `docker stats` to confirm it fits; if it does not, record the measured value and decide with the user.

### Decisions

- S5 Database recovery entry: version 1 has none. Readiness is stateless (`SELECT 1` per call, ADR-009 point 11), so a recovery entry needs a poller. The image healthcheck now exists, but Docker is the poller and records the transition in `docker compose ps` and `docker inspect`; the application keeps no memory of the previous answer. The item is closed for version 1, not left open.
- S6 Backups: not applicable to a local environment, and not claimed (ADR-006 point 9); `14` §17, §30 and §73 already say so.

## Done when

Every row of §33 and §78 has a verdict with evidence, and no "Does not meet" is left without an owner.

## Risk

None for the review itself; each fix names its own item (probably 2).

## Verification

Each verdict cites a file or a command that was run; pnpm docs:check.

## Log

L1 Request: as B7.1 (the task files for B7).
L2 Done 2026-10-25 for T1 to T3. The pass read code and ran commands (audit, an in-process header probe, counts per route file); it did not repeat B2.5. Three findings, none fixed in this branch because the allowed surfaces here are docs only; the fixes are T4 to T6 on `fix/b7-6-hardening`. `Does not meet` stays visible in the checklist until they land.
