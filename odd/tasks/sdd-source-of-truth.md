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

- [ ] T2.1 `00-overview.md`, `04-tech-stack.md`
- [x] T2.2 `05-data-model.md` regenerated against `schema.prisma` — route: delegated writer; `pnpm docs:check` and `pnpm lint` pass. Section numbers 1-51 kept (cited by code comments); §52 Job, §53 IdempotencyKey, §54 failure-mode review added. Reported, not resolved: `DecisionEvent.payload` prices as JSON numbers vs ADR-002 (pending user decision); backdated transactions vs incremental `Position` (B0); no creation-order column for ADR-003 tiebreak (B0/B4); no status for demo work (Phase 5); `schema.prisma` comment cites `07-realtime-spec.md` instead of `08` (code, B0).
- [x] T2.3 `06-architecture.md` rewritten (real monorepo + ADR-001) — route: delegated writer; `pnpm docs:check` and `pnpm lint` pass. Sections 1-66 kept (cited by code and `eslint.config.js` §43); §67 failure-mode review added. Reported: roadmap puts the position-recalculation race in B7 while ADR-001 puts it in B0 (fix in T5.3); the status legend has no ID for frontend, demo or pre-B0 CI work (pending user decision); ADR-007 does not fix the `@trading/market-sim` path (open detail, B5).
- [ ] T2.5 Close the `DecisionEvent.payload` money-format gap: replay reads `price`/`quantity` as JS numbers (`decision-replay.ts`), against ADR-002. Proposed: ADR-002 rule for money in persisted JSON, `05` §12.1 Planned (B0), B0 roadmap task (pending user approval).
- [ ] T2.4 New `16-analytics-spec.md` (ADR-004)

### Phase 3 — Product

- [ ] T3.1 `01`, `02` (acceptance criteria for all P0/P1, status per FR, new FRs)
- [ ] T3.2 `03` (measurable targets, accepted exceptions)
- [ ] T3.3 `11` (navigation aligned with wireframe)

### Phase 4 — Contracts

- [ ] T4.1 `07-api-spec.md` full reconciliation with per-endpoint status
- [ ] T4.2 `08`, `09`, `10`

### Phase 5 — Operations and living docs

- [ ] T5.1 `12`, `13`, `14`
- [ ] T5.2 `15` (backend-first override), `CONTRIBUTING.md`, `README.md`
- [ ] T5.3 `PROGRESS.md` (main-branch claim fix), `BACKEND-ROADMAP.md` (add B0)

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

## Next step

Phase 2 in progress on `docs/sdd-foundations`. T2.2 and T2.3 done. Pending user decision: T2.5 and the status-legend gap. Next: T2.4, T2.1. Reviews and assessments always use `develop` as base. Apply the failure-mode checklist while writing.
