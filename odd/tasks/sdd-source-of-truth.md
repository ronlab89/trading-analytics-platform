# Feature: SDD as Source of Truth

**Branch:** `docs/sdd-source-of-truth` (from `develop`)
**Started:** 2026-10-04
**Delivery strategy:** one PR per phase into `develop` (user-owned); no separate PR for repo chores.

## Objective

Make `docs/` a contradiction-free source of truth so further development
(B0 onwards) does not keep introducing drift between specs and code.

## Problem

The SDD mixes what exists, what is planned, and what was never decided.
Audit (2026-10-04) found: no analytics specification, ~61/79 FRs without
acceptance criteria, `07-api-spec.md` drift from the real API, `06` describing
a non-existent layout, `13`/`14`/`CONTRIBUTING.md` assuming CI and a hosted
backend, `15` missing the backend-first override, stale README/PROGRESS,
`05` drifted from `schema.prisma`, broken cross-references.

## Rules adopted

1. Every open decision is closed in an ADR (`docs/adr/`).
2. Every spec section carries a status: `Implemented`, `Planned (B#)`, `Deferred`.
3. Precedence: ADR > SDD > ROADMAP > PROGRESS. Code is evidence of what exists.

## Review exit criterion (adopted 2026-10-04)

Sampled reviews kept surfacing new implementation edge cases in the ADRs.
To converge instead of looping:

1. Edge cases are found in **one systematic pass** using the failure-mode
   checklist: concurrency, crash/restart, timeouts and expiry, retries and
   duplicates, boundary math and data edges, partial failure.
2. All findings are fixed in **one batch**.
3. Each ADR has a **"Deferred detail"** section. An edge case that does not
   change the decision goes there, assigned to its block (B0-B7), and is
   specified and tested when that block is implemented.
4. After the batch, **one** final review of the full PR. Only a finding that
   shows a decision is wrong or contradictory gets a new commit. Any other
   finding is added to "Deferred detail" and the PR proceeds.
5. The same checklist is applied in Phase 6 and at the start of every
   implementation block.

## Scope

Documentation only. No source code changes (code starts at roadmap block B0).

## Tasks

### Phase 0 — Decisions (ADRs), one at a time with the user

- [x] T0.1 ADR-001 Application layer — accepted 2026-10-04 (`docs/adr/0001-application-layer.md`), route: inline
- [x] T0.2 ADR-002 Shared contracts — accepted 2026-10-04 (`docs/adr/0002-shared-contracts.md`), route: inline
- [x] T0.3 ADR-003 Holdings-only portfolio — accepted 2026-10-04 (`docs/adr/0003-holdings-only-portfolio.md`), route: inline
- [x] T0.4 ADR-004 Analytics methodology — accepted 2026-10-04 (`docs/adr/0004-analytics-methodology.md`), route: inline
- [x] T0.5 ADR-005 Roles and authentication — accepted 2026-10-04 (`docs/adr/0005-roles-and-authentication.md`), route: inline
- [x] T0.6 ADR-006 Deployment model and minimal CI — accepted 2026-10-04 (`docs/adr/0006-deployment-model-and-ci.md`), route: inline
- [x] T0.7 ADR-007 Realtime and market simulation — accepted 2026-10-04 (`docs/adr/0007-realtime-and-market-simulation.md`), route: inline; ADR-001 amended with Actor note
- [x] T0.8 ADR-008 Background jobs (CSV import) and idempotency — accepted 2026-10-04 (`docs/adr/0008-background-jobs-csv-import.md`), route: inline
- [x] T0.9 ADR-009 Observability scope — accepted 2026-10-04 (`docs/adr/0009-observability-scope.md`), route: inline

### Phase 1 — Governance

- [x] T1.1 `docs/README.md` (index, precedence, status legend, maintenance rule), route: delegated writer
- [x] T1.2 `docs/adr/` template + accepted ADRs, route: delegated writer
- [x] T1.3 Mechanical normalization (headers, cross-refs, code fences), route: delegated writer
- [x] T1.4 `docs:check` script (cross-references, fence attributes, titles, ADR sections), route: delegated writer; `eslint.config.js` extended inline to cover `scripts/*.mjs`; `pnpm lint` and `pnpm docs:check` pass
- [ ] T1.5 Deferred from the Phase 1 review, done together with the minimal CI workflow (ADR-006, before B0): run `pnpm docs:check` in CI; harden `scripts/check-docs.mjs` (one shared fence-state helper for all checks, ADR sections as `{ name, pattern }` pairs, fixture-based tests covering fences, ADR-number lookbehind, unused-allowlist reporting and exit code).

### Phase 2 — Foundations

Branch `docs/sdd-foundations` (from `develop` after PR #10). Order approved
2026-10-05: T2.2 → T2.3 → T2.4 → T2.1. Route: one delegated writer per task
(each document exceeds the inline evidence budget), parent structural readback
plus `pnpm docs:check`.

- [x] T2.1 `00-overview.md`, `04-tech-stack.md` — route: delegated writer.
  - `04` lists the real versions from `pnpm-lock.yaml` and adds supertest, tsx, dotenv-cli, husky and lint-staged.
  - In `04`, ADR-decided tooling is `Planned (B0/B3/B5/B6/B7/FE)`. The frontend libraries no ADR decides are `Deferred`.
  - `00` states the backend-first current state and the two ADR-006 targets, with a status per scope area and a doc map that includes `16` and `adr/`.
  - ADR-008's broken `00-overview.md` §44 reference is fixed to §2.1, route inline.
  - Open details:
    - B0: TypeScript 6.0.3 vs 5.9.3 and `@types/node` 22 vs 26 across packages; `docs:check` and `format:check` in CI.
    - B1: domain `quantity` is a plain `number`.
    - B5: the `market-sim` path.
    - B6: how the OpenAPI document is served.
    - B7: the production build.
    - FE: API and WebSocket base URLs.
  - For T5.3: `BACKEND-ROADMAP.md` B7 and B5 contradict ADR-006 and ADR-007.
  - `pnpm docs:check` and `pnpm lint` pass.
- [x] T2.2 `05-data-model.md` regenerated against `schema.prisma` — route: delegated writer; `pnpm docs:check` and `pnpm lint` pass. Section numbers 1-51 kept (cited by code comments); §52 Job, §53 IdempotencyKey, §54 failure-mode review added. Reported, not resolved: `DecisionEvent.payload` prices as JSON numbers vs ADR-002 (pending user decision); backdated transactions vs incremental `Position` (B0); no creation-order column for ADR-003 tiebreak (B0/B4); no status for demo work (Phase 5); `schema.prisma` comment cites `07-realtime-spec.md` instead of `08` (code, B0).
- [x] T2.3 `06-architecture.md` rewritten (real monorepo + ADR-001) — route: delegated writer; `pnpm docs:check` and `pnpm lint` pass. Sections 1-66 kept (cited by code and `eslint.config.js` §43); §67 failure-mode review added. Reported: roadmap puts the position-recalculation race in B7 while ADR-001 puts it in B0 (fix in T5.3); the status legend has no ID for frontend, demo or pre-B0 CI work (pending user decision); ADR-007 does not fix the `@trading/market-sim` path (open detail, B5).
- [x] T2.6 Status legend (approved 2026-10-05). Adds `Planned (FE)` for decided frontend and demo work; the pre-B0 minimal CI of ADR-006 is `Planned (B0)`. The legend is updated in `docs/README.md`, route inline. Reclassifying decided frontend and demo items from `Deferred` to `Planned (FE)` in `05`, `06` and `16` goes to a delegated writer. T5.2 defines the FE block breakdown in `15`. Done: 16 entries reclassified in `06` and `05`; `16` needed no change. `pnpm docs:check` and `pnpm lint` pass. Still `Deferred` because no ADR decides them: demo data layers and reset (`05` §34-37, `06` §14), and frontend routing, state, rendering, charts, shared UI, dependency rules and performance. These are open decisions for the frontend stage and do not block B0.
- [x] T2.8 Close the analytics open details, all 13 approved by the user on 2026-10-05. Route: delegated writer (ADR-004, `16`, `05`).
  1. Returns are computed in `Decimal` end to end; numbers appear only in the presenter.
  2. TWR goes on the wire in percentage points as `twrPercent`, unrounded.
  3. Only `COMPLETED` transactions count.
  4. A `SELL` whose fees exceed `quantity × price` is rejected with 400.
  5. TWR uses the same days as P/L.
  6. Periods are counted back from `to` in UTC: `1W` is 7 days; `1M`/`3M`/`6M`/`1Y` are calendar offsets clamped to month end; `YTD` starts on 1 Jan UTC; `ALL` starts on the first transaction day.
  7. A `to` after the last closed day is clamped to it, the response carries `asOf`, and later trades are excluded.
  8. `from > to` gives 400, a future `to` is clamped, and an early `from` is clamped to `effectiveFrom`.
  9. Drawdown needs at least 2 index points, otherwise `UNKNOWN`; between equal peaks, the first is reported.
  10. BUY fees enter the cost basis and `averageEntryPrice`; SELL fees reduce realized P/L. This is a code change in B1.
  11. Attribution reports money only, with no percentage; `groupBy` accepts `asset` and `assetType`.
  12. Pulse looks back over `1Y`.
  13. The current Pulse thresholds for performance (±5%), concentration (25/50) and drawdown (−10/−20) are adopted as decided.
  - Done: written to ADR-004 (points 1, 2, 4, 5, 9, 11, 14 and new point 15, with B1 rows in Deferred detail), `16` and `05`. `pnpm docs:check` and `pnpm lint` pass.
  - Volatility thresholds aligned to the strict operators the other Pulse dimensions use (>20, >60).
  - Follow-up decided 2026-10-05: a custom range whose `from` is after the last closed day returns 200 with `InsufficientData` and `asOf` (`16` §8). No analytics open detail remains.
- [x] T2.7 ADR-004 annualization contradiction, decided 2026-10-05 (the user delegated the choice), route: inline.
  - Point 8 now uses √365, which matches the UTC calendar-day series with carry-forward and the simulator's daily candles. A trading-day series was rejected.
  - Point 11 sets the Pulse volatility thresholds on the annualized value: 20% and 60%, replacing the daily placeholders of 1% and 3%.
  - In the "Deferred detail" table, the contradictory row was replaced by the B1 code change.
  - `16` §9, §15, §16 and §17 updated, with hand-computed tests (20 returns of ±1% give ≈19.601%).
  - The performance, concentration and drawdown Pulse thresholds are still placeholders.
- [x] T2.5 Close the money-format gap in persisted JSON (approved 2026-10-05), route: inline. ADR-002 amended with decision point 9: money, prices and quantities in JSON columns are decimal strings parsed with `Decimal`, and percentage inputs to money arithmetic are converted to `Decimal` first. Two B0 rows were added to ADR-002 "Deferred detail": `decision-replay.ts` and `scenario-impact.ts`. `05` §12.1 and §15 updated. `BACKEND-ROADMAP.md` has no B0 section yet, so T5.3 carries these rows into it. `pnpm docs:check` passes.
- [x] T2.4 New `16-analytics-spec.md` (ADR-004) — route: delegated writer. The spec has 17 sections, including hand-computed test examples and a failure-mode review in §16. `docs/README.md` now links to it, and `16` was removed from `PLANNED_DOCS` in `check-docs.mjs`. `pnpm docs:check` and `pnpm lint` pass. Reported, not resolved:
  - ADR-004 contradicts itself on annualization: point 8 says √252, but its Deferred detail allows √365 (decision-level, pending user decision).
  - FR-031's breakdown by factor vs ADR-004 point 10 (T3.1).
  - FR-025 periods vs ADR-004 point 5 (T3.1).
  - The Pulse volatility thresholds assume non-annualized values (B1).
  - 11 open details assigned to B1.

### Phase 3 — Product

Branch `docs/sdd-product` (from `develop` after PR #11, 2026-10-05). Order:
T3.1 (`02` first, the 79 FRs are the contract; then `01` aligned with `02`)
→ T3.2 → T3.3. Route: one delegated writer per document, parent readback,
`pnpm docs:check`. ADR precedence settles FR conflicts (FR-025 periods and
FR-031 factor breakdown follow ADR-004); any FR without an ADR basis that
needs a product decision is asked to the user, not invented.

- [x] T3.1 `01`, `02` (acceptance criteria for all P0/P1, status per FR, new FRs)
  - [x] Part 1, `02` (delegated writer; `pnpm docs:check` and `pnpm lint` pass): 86 FRs, every one with a status. 75 of the 79 P0/P1 FRs have testable acceptance criteria; the remaining 4 are Deferred. New FRs FR-080 to FR-086 cover CSV import, job lifecycle, idempotency, session refresh, roles, analytics data boundaries and realtime sessions. FR-025 and FR-031 are aligned with ADR-004. All 79 original headings are kept. Six FRs are pending a user decision: FR-006, FR-015, the demo FRs, FR-052, FR-055 and FR-011.
  - [x] Six FR decisions approved by the user 2026-10-05, route inline:
    - New ADR-010 "Version 1 Product Scope Clarifications":
      - What Changed v1 uses only events with no threshold;
      - FR-015 is satisfied by the filters;
      - notifications are `unread`/`read` only;
      - only fully loaded lists are sorted, in the client;
      - archived portfolios are read-only (409, B0);
      - the demo specifics wait for a frontend-stage ADR.
    - `02` updated: FR-006, 011, 015, 052, 055, the demo FRs and the traceability table.
    - `05` §42 note added and the ADR index updated.
    - `pnpm docs:check` passes.
  - [x] Part 2, `01` aligned with `02` in 3 delegated slices (§1-8, §9-18, §19-end). Each section has a status and references FR IDs. Contradictions fixed: cash transaction types, delete semantics, per-tick analytics, the factor breakdown, `dismissed`, the mock-API demo, and the document chain. Three follow-up decisions, approved by the user on 2026-10-05 and applied inline:
    - FR-087 User Preferences documents the existing API.
    - Benchmark comparison is `Deferred` (ADR-010 point 7).
    - The legend gains a `Reference` status, applied to the purpose, principles, boundary, policy and traceability sections in `01` and `02`.
  - [x] T3.1 complete.
- [x] T3.2 `03` (measurable targets, accepted exceptions), done in 3 delegated slices.
  - All 71 NFRs have a status, a target, a measurement and, where they apply, ADR-cited accepted exceptions.
  - The user approved the 24 targets that had no number before (2026-10-05). The (proposed) markers were removed.
  - The user decided that v1 ships in English and Spanish: ADR-010 point 8, NFR-066, FR-087, and the `05` language column. API language validation is B0; translations are FE.
  - Parent fixes: NFR-011 lint boundary is `Planned (B0)` (ADR-001); `APP_MODE` is `Planned (FE)`.
  - For T5.3: roadmap B7 says CI was rejected and B4 lists open decisions that ADR-008 settled.
- [x] T3.3 `11` (navigation aligned with wireframe), done in 3 delegated slices plus one closing edit.
  - Navigation now matches the real wireframe: icon rail, top bar, status bar.
  - Each destination is mapped to its FR, and the gaps are listed.
  - Every section has a status, and the approved NFR targets are applied.
  - The user approved the UI decisions on 2026-10-05, recorded as ADR-010 point 9 and applied to `11` and to FR-051, 052, 053, 062 and 081.
  - The initial language is English; Spanish applies only when the user selects it (ADR-010 point 8, corrected).
  - For the frontend stage: fix `lang="es"` in the wireframe and update `WIREFRAME-PLAN.md`.

### Phase 4 — Contracts

Branch `docs/sdd-contracts` (from `develop` after PR #12, 2026-10-05). Route:
delegated writers in slices of 300-500 lines, one commit per slice.

- `07` (1715 lines, 62 real routes) is split into 5 slices: §1-9, §10-16,
  §17-24, §25-30 and §31-61.
- `08`, `09` and `10` get 3 slices each.

Product decisions that no ADR covers are asked to the user in batches.

- [x] T4.1 `07-api-spec.md` full reconciliation with per-endpoint status, done in 5 delegated slices.
  - Every endpoint is checked against the 62 real routes, and code-vs-ADR differences are recorded per block.
  - The user approved 11 API contract decisions (2026-10-05), recorded in three places:
    - ADR-002 point 10: error codes, validation detail codes, no server timeout, performance and risk response shapes, the `status` field, period parameters, theme values.
    - ADR-008 point 6: retry and cancel 409, and the import notifications including `TIMED_OUT`.
    - ADR-010 point 5: deleting on an archived portfolio returns 409.
  - The decisions are propagated to `07`, `16`, `02`, `05` and `11`.
  - Simulator control routes are left to `08`.
- [x] T4.2 `08`, `09`, `10` — complete 2026-10-06.
  - [x] `08` slice A (§1-22, `5f0d43e`) and slice B (§23-41) done.
  - [x] `08` slice C (§42-62), route: delegated writer; `pnpm docs:check` and `pnpm lint` pass.
    - All 21 sections have a status. Nothing is `Implemented`: no realtime code exists yet.
    - No new product decisions. Open details went to B5 (5 items) and FE (3 items).
    - Follow-up: §7 has no transition out of `CONNECTED`; §42 assumes `RECONNECTING`.
    - For T5.3: `BACKEND-ROADMAP.md` B5 predates ADR-007 (`notifications:{userId}`, "eleven events", settled open decisions, stale §47-51 citations).
    - Mismatch: `06` §20 says job events are `Planned (B4)`, while `08` §13 and §20 say B5.
    - `12` and `13` will need their realtime event names and disconnect scenarios aligned (T5.1).
    - Commit `f98cb86`, assess `passive`. The stop-hook candidate (base `d55fce2`, 312 files, high) was declined by the user on 2026-10-06.
  - [x] User decision on the pending `08` items, one batch (all 9 approved 2026-10-06; recorded as ADR-007 point 15; applied to `08`, `07` §54 and `06` §20-21 by a delegated writer; `pnpm docs:check` and `pnpm lint` pass). Also fixed: `08` §7 `CONNECTED → RECONNECTING` / `DISCONNECTED`; job events are `Planned (B5)` in `06` and `08` (the transport arrives in B5). Decision 2 is stated precisely: only `TIMED_OUT` has a notification (ADR-008 point 6). Open: `PAUSED` is both a mode wire ID and a lifecycle state (ADR-007 Deferred detail, B5, needs a user decision). The batch items were:
    - the `ALERT_TRIGGERED` channel;
    - whether `CANCELLED` and `TIMED_OUT` jobs emit events;
    - protocol message names, close codes and errors;
    - numeric limits and the missed-pong rule;
    - the `tickChange` field name;
    - simulator control paths and payloads (`07` §54 points to `08`, but ADR-007 has none);
    - whether real mode has stop or seed reset;
    - the tick interval and the HTTP polling interval while the socket is down;
    - wire identifiers for modes and scenarios.
  - [x] `09` in 3 slices (2026-10-06), route: delegated writer per slice; `pnpm docs:check` and `pnpm lint` pass each time. A §1-17 `3ad8727`, B §18-35 `4982b6e`, C §36-58 `d737cc5`. Each stop-hook candidate (base `d55fce2`) was declined by the user. Scoped RDD review of the `09` range (base `c07677b`, 4 lenses) approved and acknowledged; its two readability suggestions (commit reference here, `09` §3 paragraph density) were applied.
    - Every section has a status; code-vs-ADR differences are recorded per block (roles `USER`/`ADMIN` vs ADR-005, no refresh/logout, params not schema-validated, `{ field, message }` details, superuser DB role, unbound Postgres port, `DATABASE_URL` not validated, login timing).
    - Pending user decisions: (1) `VIEWER` self-service mutations (preferences, mark notifications read); (2) `ADMIN` permissions beyond `simulation:control`; (3) WebSocket connection cap per user or IP; (4) separate runtime DB role; (5) login timing equalization; (6) confirm route-param validation in B0.
    - For later tasks: `BACKEND-ROADMAP.md` B2 (`requireRole`, settled decisions) and B7 (CI) are stale (T5.3); `07` §45 and NFR-021 claim params are validated; NFR-019/022/023 name missing tests; `13` names `auth.logout`, which ADR-009 lacks (T5.1); `PROGRESS.md` §7 search debt is assets only (T5.3).
  - [x] The 7 pending decisions (six `09` items and `PAUSED`) approved by the user 2026-10-06, route: delegated writer, commit `00b307a`: ADR-005 point 13 (VIEWER self-service, no extra ADMIN permissions, per-user WebSocket cap of 5 closing with `4008`, runtime DB role Planned B0, login timing equalization Planned B0), ADR-002 point 10 (malformed route param 400 `VALIDATION_ERROR`; well-formed unknown or foreign ID 404 `NOT_FOUND`; Planned B0), ADR-007 point 16 (lifecycle state renamed `HALTED`; `PAUSED` stays the public mode wire ID). Alignment follow-up `9e1af65` (`03` NFR-021, `08` §7/§9 cap, `12` lifecycle diagram). The stop-hook candidate (base `d55fce2`) was declined again by the user.
    - Open: which connection closes when the cap is hit (new or oldest), B5.
    - Open: whether the `simulation.paused` event in `13` follows `HALTED` or stays tied to `/pause` (needs a user decision).
    - For T5.3: `BACKEND-ROADMAP.md` B0 needs the runtime DB role, login timing and route-param schemas; B2 the VIEWER self-service permissions; B5 the cap and the `HALTED` rename.
  - [x] `10` in 3 slices (2026-10-06), route: delegated writer per slice; `pnpm docs:check` and `pnpm lint` pass each time. A §1-20 `f2d52c3`, B §21-40 `aa561b0`, C §41-65 `87b688c`. User decisions: `simulation.paused` in `13` stays tied to `/pause` (no change); ADR-006 point 11 `7f84431` (CI also runs `format:check` and `build`; no coverage threshold in v1; frontend test tooling goes to the frontend-stage ADR); CSV import is a critical E2E flow in §33, `Planned (FE)`.
    - Six `10` decisions approved by the user 2026-10-06, route: delegated writer, commit `d676429`: ADR-001 point 8 (one shared `Clock` port, B0; route tests for analytics, positions, assets and market in B0 before the layering refactor); ADR-006 point 11 extended (component/E2E/a11y CI checks, a11y tool and HTTP client timeout/retry go to the frontend-stage ADR); NFR-008 is enough for v1 and the memory target stays `Deferred` (`10` §41).
    - For T5.3: `BACKEND-ROADMAP.md` and `15` B0 scope need the `Clock` port and the four route test files. For later: `06` line 214 and 781 should cite ADR-001 point 8; ADR-007 point 7 could cross-reference it; `04` §33 should point the a11y tool to the frontend-stage ADR; `03` NFR-008 could state no larger target in v1.
    - For later tasks: PR template checklist lacks format, build and tests (T5.2); `CONTRIBUTING.md` CI wording (T5.2); `08` and `09` headers still say `Draft`; `validateNewTransaction` reads `new Date()` directly (B0); `transactions.routes.test.ts` lacks a cross-user case; no test asserts notification ordering.

### Phase 5 — Operations and living docs

Branch `docs/sdd-operations` (from `develop` after the Phase 4 PR merge, 2026-10-06). Order approved by the user: `13` → `14` → T5.2 (`15`, `CONTRIBUTING.md`, `README.md`) → T5.3 (`BACKEND-ROADMAP.md`, `PROGRESS.md`, collecting every "For T5.3" item) → `12` last (frontend-only). Route: one delegated writer per slice of 300-500 lines, one commit per slice. `13` is split into 5 slices: §1-12, §13-27, §28-42, §43-57, §58-end.

- [ ] T5.1 `12`, `13`, `14`
  - [x] `13` in 5 slices. A §1-12 `a414592` (`pnpm docs:check` and `pnpm lint` pass). Pending user decisions from A (batched at the end of `13`): `errorCategory` vs `errorName` (§7); extra B3 log fields (§7); log levels for `FORBIDDEN`, `RATE_LIMITED`, `DEPENDENCY_ERROR` (§6.2); B3 names of `request.failed` and `health.database.unavailable` (§8); scrub error messages or only named fields (§11); expose `X-Request-ID` through CORS (§9, FE).
    - B §13-27 `54ba55f`. Pending: block for graceful shutdown and 503 readiness while shutting down (§23; code has no SIGTERM handling); DB operation timing or Prisma query logging in dev (§21, §25); health route tests for NFR-051, maybe B0 with the ADR-001 point 8 route tests (§22). Found: NFR-051 is `Implemented` but no test covers `/health` or `/health/ready`.
    - C §28-42 `1e228a9`. Pending (frontend stage): development-only realtime debug mode or diagnostics panel (§28, §39, §40); explicit demo diagnostics interface (§30, `12` §75). Found: `AppErrorCode` still declares `TIMEOUT` (removal is B0 per `07`).
    - D §43-57 `2eaac4a`. Pending: logout event and its name (§44, same as `09` §50); refresh failures other than token reuse get their own event (§44); simulator event names (`simulation.resumed`, `simulation.error`, mode changes; §56, ADR-009 point 11 lists none). Found: a DB outage on a normal request returns 500 `INTERNAL_ERROR`, not 503 (B0); `SLOW_OPERATION_THRESHOLD_MS` near line 2355 needs aligning in slice E.
    - Paused by the user after slice D (2026-10-06).
    - E §58-77 and header `bcf3b9a` (2026-10-07, route: delegated writer; `pnpm docs:check` and `pnpm lint` pass). All 20 sections carry a status; the header reads "reconciled 2026-10-07". Pending user decisions from E (batched with the others), each with the writer's recommendation:
      - Whether a database recovery entry exists and its name (§58): defer until something polls `/health/ready` (B7 healthcheck), because readiness is stateless.
      - Slow-request env var name (§68): `SLOW_REQUEST_THRESHOLD_MS` over `SLOW_OPERATION_THRESHOLD_MS`, since the decided threshold is HTTP-only (ADR-009 point 8 times series reconstruction separately).
      - Dependency audit or license CI step (§63): none in v1 (NFR-070).
      - Health route tests in B0 (§59-62): amend ADR-001 point 8 or add them to the B0 scope in T5.3.
      - `LOG_FORMAT`, `ENABLE_DEBUG_LOGGING`, `ENABLE_DEV_DIAGNOSTICS` (§68): do not adopt.
    - Found in E: ADR-009 point 11 cites ADR-006 for graceful shutdown but ADR-006 has none (only `14` §16 requires it; no signal handling in code); `14` §10 lists `DEMO_MODE` and `JWT_EXPIRES_IN` while ADR-006 point 8 and `env.ts` use `APP_MODE` and `JWT_EXPIRES_IN_SECONDS` (for the `14` slice); `README.md` and `CONTRIBUTING.md` document no API start, logs, health or `LOG_LEVEL` (T5.2); no `no-console` ESLint rule; `@trading/application` does not exist yet, so the B3 `Logger` port depends on B0; `docs/` is in `.prettierignore`, so `format:check` never covers the SDD; `.github/` holds only the PR template.
    - `13` is fully reconciled.
    - [x] Decision batch approved by the user 2026-10-07: 18 distinct decisions (the 19 counted "health route tests" twice), all as recommended, `pino`, `pino-http` and `pino-pretty` reconfirmed. Route: delegated writer for the ADRs, then one for `13`; `pnpm docs:check` and `pnpm lint` pass each time. Recorded in ADR-009 (points 2-9, 11-13, Deferred detail), ADR-006 point 12 (graceful shutdown, B3) and ADR-001 point 8 (health route test, B0), with `docs/adr/README.md` and `04` §42-45 aligned: `28a14ca`. Propagated to `13`: `158456b`. Assess against `develop`: passive both times.
    - Writer additions, not in the approved list: an ADR-006 Deferred detail row (B4/B5: `14` §16 shutdown steps for jobs and realtime join the sequence when those components exist) and an `Amended:` header line on ADR-006 and ADR-009.
    - Open details left on purpose (no decision covers them): levels of startup, shutdown and simulator entries; route template vs raw URL in request logs (§17); a separate threshold or timer helper for the analytics series (§26, §52); the slow-request entry name (§53); job entry names and fields (B4); realtime log names and sampling (B5); `LOG_LEVEL` validation in `env.ts`; connection-pool check; demo event names; sanitized client context; error-handler test assignment.
    - Minor contradiction to settle in B3: ADR-009 point 3 limits `errorName` to the unexpected-error line, while the `health.database.unavailable` line logs `errorName` today (§23-24). Recommendation: keep it there, since it carries no driver message.
    - For T5.3 and later docs: `BACKEND-ROADMAP.md` lists graceful shutdown in B7 (and B4) but ADR-006 point 12 says B3; B0 needs the health route test; B2 needs `auth.logout`; B3 needs CORS `exposedHeaders`; B7 the recovery entry. `09` §50 needs `auth.logout` and no refresh-failure event; `14` §10 and §16 need `SLOW_REQUEST_THRESHOLD_MS`, the shutdown details (point 12, 10 s drain, 503 readiness) and no `LOG_FORMAT`; `12` §75 diagnostics deferred; `15` B0, B2, B3 and B5 scopes.
  - [x] `14` in 5 slices (2026-10-07, one delegated writer per slice via the shared brief `brief-14.md`; `pnpm docs:check` and `pnpm lint` pass each time; assess against `develop`: passive). A header + §1-20 `2cc5794`; B §21-40 `db8a4a3`; C §41-60 `a74dfa5`; D §61-80 `d49d2d4`; E §81-96 + header + Document Status `533e02d`. `14` is fully reconciled; every section has a status. Paused by the user after slice E; the decision batch is presented when the user says to resume.
    - [x] Decision batch approved by the user 2026-10-07: 19 decisions (about 35 raw pending items deduplicated; "validation running at shutdown" was already decided by ADR-008 point 5; the `migrate deploy` conflict between slices A and B was resolved as a one-shot `migrate` service with the API entrypoint `node dist/index.js`), all as recommended. Recorded in ADR-006 (points 4, 8, 11, 12, new 13), ADR-007 (point 1, point 16, Deferred detail), ADR-008 point 4, ADR-009 point 11, ADR-010 point 6, ADR-005 point 13 note, with `docs/adr/README.md` and `04` aligned: `5c52b49`. Five Deferred detail rows added (Prisma `connection_limit` B7, dev rate limits B0, WebSocket `maxPayload` B5, realtime hub interface B5, CSV transport and body limit B4). Propagated: `14` §1-40 `a2cb8bc`, `14` §41-96 `7609566`, ADR-006 Deferred-detail reword `bc5471c`; `05`, `07`, `08`, `09`, `13` aligned in `1d6d8dc`. `pnpm docs:check` and `pnpm lint` pass each time; assess against `develop`: passive.
    - Review record (2026-10-07): the range `develop..HEAD` after the 14 decision batch was assessed `high` (16 files, 3533 lines; reason `hot_path`, signal `security` in `docs/09-security-spec.md`, a one-sentence edit about the connection cap). The user declined the native review for this candidate (`declined_this_candidate`, target `sha256:2d0d3315...`); no review record exists and the next medium or high candidate asks again. The earlier assessments of the same phase were `passive`.
    - T1.5 CI part is now decided in ADR-006 point 11 (`docs:check` runs in CI, `Planned (B0)`); hardening `scripts/check-docs.mjs` stays open for B0.
    - Open details left on purpose (no decision covers them): frontend container; `127.0.0.1` binding of the PostgreSQL port; `DATABASE_URL` for a containerised API; image details (production dependency separation, variable injection, base-image pinning; B7); `engines.pnpm`; TypeScript version skew; WebSocket `Origin` check; refresh-cookie `Secure` flag; missed-pong close code (B5); log levels of startup and shutdown entries (B3, no ADR sets them); invalid-environment failure as a structured line (B3); dedicated token-refresh limiter (B2); CI stage order and CI PostgreSQL image version; content of smoke check 5 (B7).
    - Inconsistency to settle in B5: ADR-007 Deferred detail says `maxPayload` equals the inbound message limit of `08` §7, but `08` §7 only gives a rate (20 messages per second) and no per-message size; `09` §27 still lists the maximum inbound message size as open. Recommendation: set the byte size in B5 and cite it from both places.
    - ADR-009 Deferred detail has no row for lifecycle log levels; `14` now says "no ADR sets them".
    - Pending user decisions as originally collected (raw, now all resolved above):
      - A: behaviour when the 10 s drain expires and exit code (§16): close remaining connections, exit 1 on timeout, 0 otherwise; where `migrate deploy` runs (§15, B7): container entrypoint; seed guard (§20, B0): refuse when `NODE_ENV=production`; frontend container (§5): none in v1; how the real-mode web build gets the API and WebSocket base URLs (§14): no recommendation yet; whether `WEBSOCKET_PATH` is a variable (§10, B5).
      - B: hard reset and seed guard (§21, §20): refuse when `NODE_ENV=production` (B0); Dockerfile at `apps/api/Dockerfile` with the workspace root as context (§26); entrypoint `node dist/index.js` so `SIGTERM` reaches the process (§26); `VITE_APP_MODE` at build time so the demo bundle has no HTTP adapter (§23); real-mode web in the local stack = Vite dev server against the local API (§27); how the demo build reaches the portfolio site and its host HTTPS/SPA fallback (§22, §28): frontend-stage ADR; numeric bound for the demo simulation (§24): same ADR; `CORS_ORIGIN` validation (§33, B0): only `http(s)://host[:port]`, reject `*`; Node version and `engines.pnpm` (§37): `.nvmrc` reused in CI and the Dockerfile, align `engines.pnpm` with `packageManager`; WebSocket path and port (§31): same server and port 7001, fixed path.
      - C: amend ADR-006 point 11 so CI runs `docs:check` (T1.5; `docs/` is in `.prettierignore`); pin the Node major in `.nvmrc` (§37, §43, §59; confirm LTS; align `engines.node` and `@types/node`); test env through job `env`, not a generated `.env.test.local` (§43); 503 body while shutting down = `status: "unavailable"` with no `checks` (§50); container healthcheck probes `GET /health/ready` (§51); startup entries `app.startup.started` and `app.startup.completed` (§52); one smoke script after `docker compose --profile full up`, no frontend step (§49); a running validation at shutdown is marked `INTERRUPTED` on the next startup (§54); `TZ=UTC` on the API and PostgreSQL containers (§60); CI test database uses the ADR-005 point 13 runtime and migration roles (§42).
      - D: CSV transport, size limit and a route-specific body limit (B4; global JSON limit is 100 kB); retention of stored CSV input: keep while retryable, clear for `COMPLETED` and `VALIDATION_FAILED` (B4); keep development rate limits and document that restarting clears counters; `full` profile `connection_limit`: Prisma default until measured (B7); WebSocket `maxPayload` of a few kB (B5); realtime hub behind its own interface, no broker in v1 (B5); WebSocket path and port (repeat); which connection closes at the per-user cap (B5, repeat); demo base path as a build-time setting beside `VITE_APP_MODE` and confirming the portfolio host's SPA fallback.
    - Found: `env.ts` does not read `APP_MODE` and does not validate `DATABASE_URL` (Planned B7); the seed always wipes with no guard; `.env.example` has a stale Spanish note and lacks B3/FE variables; Compose fallback password differs from the `.env.example` placeholder; backend port is 7001, not 3000; `docker/` and `.github/` hold only `.gitkeep` and the PR template; `app.ts` sets no `trust proxy`; `X-Request-ID` is not exposed by CORS; no ESLint import-boundary rule; `typescript` `^5.7.3` vs `^6.0.3` and `@types/node` `^22` vs `^26` across packages; readiness returns 200 on an unmigrated database; migrations declare `TIMESTAMP(3)` without a time zone; `Job` and `IdempotencyKey` are in `05` §52-53 but not in `schema.prisma`; ADR-005 point 13 expects roles but nothing checks `role` (`requireRole` is B2); no pool configured (Prisma default); `pnpm db:migrate` runs `prisma migrate dev`; `docs/14` working copy was CRLF while git stores LF (the Edit tool normalizes it; the diff is content-only).
    - For later tasks: `13` line ~2660 still says `14` §10 lists `DEMO_MODE` and `JWT_EXPIRES_IN` (stale, fix with the `13` alignment); `15` §19 (Phase 14) still lists HTTPS/WSS configuration and rollback documentation that ADR-006 points 2 and 6 remove (T5.2); `12` §41 job examples and `retrying` lifecycle exceed ADR-008, and its "mock infrastructure" wording needs the in-process adapter (T5.1, `12`); `.github/PULL_REQUEST_TEMPLATE.md` lacks format, build and tests (T5.2); `README.md` has a stale status, no `.env` step and no API start or health step (T5.2); `CONTRIBUTING.md` has no setup, CI wording or troubleshooting (T5.2); `BACKEND-ROADMAP.md` B7 says CI was rejected, puts graceful shutdown in B7/B4 (ADR-006 point 12: B3), and needs the Dockerfile location, the `SIGTERM` entrypoint, `CORS_ORIGIN` validation and the seed guard in B0 (T5.3); NFR-051 measurement ("health route tests") has no test yet (B0); NFR-054 points to the security checklist (`14` §78).
- [x] T5.2 `15` (backend-first override), `CONTRIBUTING.md`, `README.md`
  - Plan (2026-10-07), approved one slice at a time by the user ("I approve each slice and tell you when to continue"); subagent for the heavy slices, inline for small ones. `15` (2153 lines) in slices A-G2, then H (`CONTRIBUTING.md` and `.github/PULL_REQUEST_TEMPLATE.md`) and I (`README.md`). Assess each commit against the last resolved boundary (see the review rule in memory); the boundary after the declined 14 batch is `c46a76a`.
    - A: header + §1-4 + new §4.1 Backend-First Override, §4.2 Phase-to-Block Mapping, §4.3 Frontend Blocks (FE0-FE6) — `e4de450`, route inline (user decision: A inline, B-G subagent), `pnpm docs:check` and `pnpm lint` pass, assess passive. The user approved the seven FE blocks 2026-10-07 (may be revised when the frontend stage starts). Found: `BACKEND-ROADMAP.md` cites "the plan's rule 11" (demo first) but `15` §3 has 10 rules and none states it (T5.3). Open before FE0: the frontend-stage ADR (routing, state, rendering, charts, shared UI, a11y tool, HTTP client timeout/retry, frontend test tooling, demo specifics).
    - B §5-10 (Phases 0-5) `8e5f5a7`, route: delegated writer (brief `brief-15.md`), `pnpm docs:check` and `pnpm lint` pass, assess passive. User decisions 2026-10-07 (applied in `8dbd55a`): expired-token and wrong-signature tests are `Planned (B2)` with the refresh tests; no editor conventions (`.editorconfig`, `.vscode/`) in v1. Found: `README.md` stale ("API not started", "15 entities" vs 16); `apps/web/wireframe.html` has `lang="es"` vs ADR-010 point 8 (FE0); no ESLint import-boundary rule (B0); `authenticate` puts `role` as a plain string and nothing checks it (B2).
    - C §11-16 (Phases 6-11) `a4f7c20`, route: delegated writer, checks pass, assess passive. User decisions 2026-10-07: transactions are immutable (ADR-003 point 7), win/loss and transaction statistics are not in v1 (ADR-010 point 10), `@trading/market-sim` lives at `packages/market-sim` (ADR-007 point 7), transport performance stays "measure first" until B5; recorded in `b52c2e0` and propagated in `fd2467d` (`15`, `06`, `14`). Found: chronological validation is B0 (ADR-003 point 6, FR-018) while fees and the currency check are B1 (my brief wrongly said B1 for both, the writer used the ADRs); `05` §8 and §45 put the position-recalculation race in B7, ADRs and FR-017 say B0 (fix `05` and the roadmap); `createTransaction` checks ownership only, `PATCH` on an archived portfolio is accepted, `position-recalculation.ts` ignores fees; the overview has no route tests and is not in ADR-001 point 8.
    - D §17-23 (Phases 12-16, dependency graph, vertical slices) `b336c3d`, route: delegated writer, checks pass, assess passive. User decisions 2026-10-07 (applied in the next commit): the case study follows the portfolio site's project-page structure, decided when FE6 starts, with the §21 list as a content checklist; FE blocks keep the numeric order of §4.3 and FE2, FE3 and FE4 do not overlap. Found: `env.ts` reads only `PORT` and `JWT_EXPIRES_IN_SECONDS`; no `.nvmrc`, `apps/api/Dockerfile` or Compose `full` profile exist; today's only structured log lines (`request.failed`, `health.database.unavailable`) use `console.error` without `timestamp` or `service`; no NFR sets a bundle-size or payload target; `00-overview.md` §15 marks the case study `Deferred` while `15` §21 gives it FE6 (label only); `10-testing-strategy.md` should state that wrong-signature tests are B2.
    - E §24-37 (strategies) 2026-10-08, route: delegated writer, `pnpm docs:check` and `pnpm lint` pass, +338/-4 lines in `15`. Pending user decisions: (1) which FE block owns the Dashboard, Markets, watchlist, decisions, scenarios, preferences and language screens (their APIs exist, §4.3 assigns no block); (2) how the application layer hands events to the realtime adapter (no ADR; `13` line ~2794 says no ADR defines domain events); (3) where the `full` stack smoke test gets its user, since ADR-006 points 5 and 13 forbid automatic and production seeding; (4) whether a client reconnect links to the earlier `connectionId` in logs (ADR-009). Found: `15` §23 lacks a blank line before `### Slice 1 — Authentication` and still says "mock infrastructure" for slice 7 (ADR-008 in-process adapter).
    - F §38-51 (workflow, completion, demos, SDD change management) 2026-10-08, route: delegated writer, `pnpm docs:check` and `pnpm lint` pass, +332/-1 lines in `15`. Pending user decisions: (1) squash vs merge commits (CONTRIBUTING §4 requires squash, history has 13 merge commits); (2) the `style` commit type (6 commits use it, not listed in CONTRIBUTING §6 or `15` §38); (3) commit-message check (`.husky/` has only `pre-commit`, no commitlint, no ADR decides one); (4) an Evidence field in `docs/adr/template.md` (§44 asks for it; it would change `scripts/check-docs.mjs`); (5) how a reviewer sees the real stack for the case study (local only per ADR-006). Found: `CONTRIBUTING.md:60` CI wording, `:103-119` commit types and no setup/troubleshooting, `:161-166` doc set and `PROGRESS.md` location; `README.md:10-12` and `:76-82`; `.github/PULL_REQUEST_TEMPLATE.md:54-55`; no `.github/workflows`, no `.nvmrc`; `BACKEND-ROADMAP.md:17-19` "rule 11".
    - G1 §52-62 (milestones and final gates) `d335da6` (+235/-1) and G2 §63-67 (sequence, validation, definition of done) 2026-10-08 (+138/-1), route: delegated writer, `pnpm docs:check` and `pnpm lint` pass, assess passive. `15` is fully reconciled (§1-67). Pending user decisions: (1) which block runs the security review (§57 and §61 say B2, `BACKEND-ROADMAP.md` calls B7 hardening); (2) which block owns performance measurement (no ADR; ADR-009 point 10 defers metrics); (3) frontend libraries named in §66 (TanStack Query/Table, Zustand, form validation, component and E2E tooling) stay `Deferred` to the frontend-stage ADR; (4) drop or keep the "External APIs" box in the §64 diagram (ADR-007 uses the simulator); (5) the definition of the M3 "primary user workflow" (needs the frontend-stage ADR). Found: `docs/README.md` line 64 may need a refresh now that `15` is complete (not verified).
    - H (`CONTRIBUTING.md`, PR template) 2026-10-08, route: delegated writer, `pnpm docs:check` and `pnpm lint` pass, prettier passes on the two files (+147/-19), assess passive. `CONTRIBUTING.md`: CI worded as planned for B0 (ADR-006 points 10-11), PRs target `develop`, doc set and `docs/PROGRESS.md` fixed, new setup (§9), troubleshooting (§10), ADR/SDD change process (§11) and Pending decisions (§12); PR template adds `develop`, `format:check`, `build`, `test`, `docs:check`. Pending user decisions already listed (squash vs merge commits, `style` type, commit-message check). Found: `.env.example` and `.env.test.example` were unreadable to the writer (permission denied), so the setup wording does not rely on their contents; `pnpm format:check` fails repo-wide on LF/CRLF (`core.autocrlf=true`, pre-existing, not from this slice); `15` lines ~2321-2332 and ~2858-2908 still describe the CONTRIBUTING and PR-template gaps as open (mark `Implemented`), and `15` §49 labels the README as slice H while the plan calls it I.
    - I (`README.md`) 2026-10-08, route: delegated writer, `pnpm docs:check` and `pnpm lint` pass, prettier passes on the file (+43/-10), assess passive. Real status (backend-first, what is and is not built), doc set (`00`-`15`, `16`, `docs/adr/`), 16 models, new "Run the API" flow with `GET /health` and `GET /health/ready`, structure notes, links to `CONTRIBUTING.md` §9-10 and `docs/adr/`; no badges (no CI workflow). Left out: `LOG_LEVEL` (only in ADR-009 lines 42, 75, 168, planned for B3). Found: the README seed figures (1 demo user, 3 portfolios, 7 assets, 30 days) were pre-existing and not re-verified against the seed code; `.env.example` unreadable to the writer. T5.2 is done once the `15` gaps fixed by H and I are marked (lines ~2321-2332 and ~2858-2908).
    - Decision batch of E, F and G (14 decisions) approved as recommended and applied 2026-10-08, route: delegated writer plus inline fixes, `pnpm docs:check` and `pnpm lint` pass. ADR record `6c71a2a`: ADR-007 point 17 (`RealtimePublisher` port in `packages/application`, no domain events in v1), ADR-006 smoke-test clarification (local `full` stack, `NODE_ENV` other than `production`, explicit `db:seed` step), ADR-009 point 5 (reconnect not linked, correlate by `userId`). Propagation: `15` (screen assignment in §4.3: Dashboard, Markets, watchlist, decisions and scenarios in FE2, Alerts tab in FE3, preferences and language in FE0; M3 workflow in §54; security review B2 plus B7 final pass; performance measurement B5 and FE5; "External APIs" box replaced by "Market simulator (ADR-007)"; frontend libraries confirmed `Deferred`; §44 no longer requires an Evidence field; case study uses a hosted static demo plus a recording), `CONTRIBUTING.md` (merge commits, `style` type, no commit-message check), `BACKEND-ROADMAP.md` (B2, B5, B7 ownership), `13` (two stale lines) and `14` §49 (explicit seed step). T5.2 is complete: `CONTRIBUTING.md`, PR template and README gaps marked `Implemented` in `15`; CI stays `Planned (B0)`. Found: `15` lines ~128-129 still point to T5.2 roadmap tasks; `BACKEND-ROADMAP.md` is rewritten in T5.3 (add B0, race from B7 to B0, rule 11, graceful shutdown in B3).
    - T5.3 part 1: `BACKEND-ROADMAP.md` 2026-10-08, route: delegated writer plus inline fixes, `pnpm docs:check` and `pnpm lint` pass, prettier passes (+577/-198; above the ~400 heuristic because B0 is a new block and B1-B7 were realigned). New B0 (scope of `15` §17 plus every B0 "Deferred detail" row of ADR-001, 002, 003, 006); B1 settled by ADR-004 and ADR-010; B2 refresh/logout, `requireRole`, VIEWER self-service, `auth.logout`; B3 `pino`, ADR-009 events, CORS `exposedHeaders`, graceful shutdown; B4 aligned to ADR-008 (CSV import, cancel endpoint); B5 aligned to ADR-007 (`ws`, `packages/market-sim`, `RealtimePublisher`, `HALTED`, cap of 5); B7 no longer claims CI was rejected nor owns graceful shutdown or the position race. The "rule 11" citation now points to `15` §4.1. Inline: `05` §8 and §45 race moved from B7 to B0; `15` notes on rule 11, B0 and the race updated. Applied the "For T5.3" items at task-file lines 90, 93, 118, 158, 192, 209, 213, 216, 233, 241, 255, 258. Ambiguities resolved from the ADRs: seven v1 realtime events (ADR-007 point 6), not eleven; channel is `notifications` scoped to the user, not `notifications:{userId}`; Dockerfile location and `SIGTERM` entrypoint are noted in B0 but built in B7 (ADR-006 point 4). Decided by the user 2026-10-08: (1) the Dockerfile location and `SIGTERM` entrypoint stay as notes in B0 and are built in B7 (ADR-006 point 4), so B3 and B7 agree; (2) `15` says "B0 to B7" in §4.1 and the places that cite it (lines ~118, 574, 2434, 3105). Found for part 2: `PROGRESS.md:6` old banner, `:764-786` CI and race debts, §7 search debt is assets only (only `prisma-asset-repository.ts:32-33` has a `contains` filter), README seed figures unverified.
    - T5.3 part 2, `PROGRESS.md` in 3 slices (P1 header, §1, §2 lines 1-248; P2 §3 lines 249-619; P3 §4-8 lines 620-878). P1 2026-10-08, route: delegated writer, `pnpm docs:check` and `pnpm lint` pass, prettier passes (+77/-41), assess passive. Banner replaced by a note dated 2026-10-08, branch is `docs/sdd-operations`, §1 rewritten to the build order (minimal CI, B0 to B7, FE0 to FE6, next block B0), §2 counts verified (15 routers mounted, 16 models). Verified: `feat/api-foundation`, `feat/decisions` and `feat/scenarios` are ancestors of `develop` (PRs #6, #7, #8) and not of `main`, which holds only the initial commit `42839b1`. Pending for P3: another `main` claim at `PROGRESS.md` ~lines 757-760 (`feat/database-infrastructure` "into `main`") and ~810 (`main`/ package entry points); CI and race debts at ~764-786; the search debt is assets only; §3 heading says "Done This Session".
    - P2 §3 (history) 2026-10-08, route: delegated writer, `pnpm docs:check` and `pnpm lint` pass, prettier passes (+94/-9), assess passive. §3 retitled "Hardening & Extensions Done Before the SDD Reconciliation (history)" (number kept, `BACKEND-ROADMAP.md` still cites `PROGRESS.md` §3.7); history kept with "Since then" notes citing ADRs and roadmap blocks: position race, chronological validation, archived-portfolio guard, `Clock` port and application layer in B0; fees in cost basis B1 (ADR-004 point 15); notifications `unread`/`read` only (ADR-010 point 3); `MarketPrice.previousPrice` is the last daily close (ADR-007 point 14). Unverified: "22 tests across 6 files" (historical), the concurrent-SELL race (inferred from code and roadmap, no test), the "B.3 (7 files)" count. Found for P3: stale "this session" wording at ~678 and ~755 and in the §5 heading.
- [ ] T5.3 `PROGRESS.md` (main-branch claim fix), `BACKEND-ROADMAP.md` (add B0, including every ADR "Deferred detail" row assigned to B0; move the position-recalculation race from B7 to B0 per ADR-001)

### Phase 6 — Verification

- [ ] T6.1 `docs:check` passes
- [ ] T6.2 Independent read-only contradiction review, one correction round

## Progress

- 2026-10-04: branch created; `chore(repo): stop tracking local ai state` (`2c7469d`).
- 2026-10-04: ADR-001 committed (`1120f2e`).
- 2026-10-04: ADR-002 committed (`f0341cf`).
- 2026-10-04: ADR-003 committed (`975db68`).
- 2026-10-04: ADR-004 committed (`c453dc6`).
- 2026-10-04: ADR-005 committed (`4799f51`).
- 2026-10-04: ADR-006 committed (`dc98597`).
- 2026-10-04: ADR-001 amended (`ce90667`); ADR-007 committed (`03ad203`).
- 2026-10-04: ADR-008 committed (`bc94ca0`); ADR-009 committed (`271b627`). Phase 0 complete.
- 2026-10-04: RDD review of Phase 0 (base `origin/develop`) approved and acknowledged; three advisory findings accepted by the user and fixed: ADR-004 daily-return formula (negative denominator on sales), ADR-008 timeout during apply and `QUEUED` jobs on restart.
- 2026-10-04: second RDD review (full PR, base `origin/develop`) approved and acknowledged; three advisory findings accepted and fixed: ADR-008 input storage and non-retryable validation failures, ADR-007 socket bound to token expiry, superseded-in-part banners on `PROGRESS.md` and `BACKEND-ROADMAP.md`.
- 2026-10-04: systematic failure-mode audit of all ADRs (6-category checklist): 2 decision findings fixed (X1 simulator closes daily candles; X2 chronological transaction validation), 26 implementation details recorded in each ADR's "Deferred detail" section.
- 2026-10-04: Phase 1 (governance): `scripts/check-docs.mjs` + `pnpm docs:check`; RED 220 problems (190 fence attributes, 17 broken or placeholder references, 13 non-conforming titles), GREEN 0 after normalizing docs 00-15; `docs/README.md`, `docs/adr/README.md`, `docs/adr/template.md` added. `pnpm lint` fails on the new script until `eslint.config.js` covers `scripts/*.mjs`.

- 2026-10-05: Phase 2 on `docs/sdd-foundations`:
  - Commits: T2.2 `beed0ff`, T2.3 `e639a7e`, T2.5 `77dad0c`, T2.4 `ce68543`.
  - Assessments against `develop`: the first three were passive. The fourth was medium, because `check-docs.mjs` is an executable change and the slice budget was reached.
  - That medium slice got an RDD review (base `develop`, reliability lens), approved and acknowledged.
  - The review left two advisory findings: the edge case of SELL fees larger than the proceeds in `16` §6, kept for the B1 open-detail decision, and a stale next step in this document, now fixed.

## Next step

Phase 4 is complete on `docs/sdd-contracts` (2026-10-06): T4.1 `07`, T4.2 `08`, `09`, `10`, and every user decision recorded as an ADR amendment. `pr-body.md` is written and the user runs the push and `gh pr create` (base `develop`).

Phase 4 PR merged into `develop`. Phase 5 started on `docs/sdd-operations`; `13` slice E done 2026-10-07 (`bcf3b9a`); the 18 `13` decisions were approved and applied the same day (`28a14ca`, `158456b`). `13` is closed; the user decides when to continue.

Resume with:

1. `14` is closed (2026-10-07): slices A-E (last `533e02d`), the 19 decisions approved and applied (`5c52b49`, `a2cb8bc`, `7609566`). The user decides when to continue.
2. Next: T5.3 part 2, `PROGRESS.md` slice P3 (§4-8, lines ~700-970: environment files, last commits, immediate next step, deferred items, how to resume; includes the `main` claims, CI and race debts and the assets-only search debt); then `12` last. The user says when to continue after each slice and decides when to stop.
3. One open detail for B5: which connection closes when the per-user cap is hit (new or oldest).

PR reviews use `develop` as base. Sub-agent slices are 300-500 lines.
