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

- [ ] T4.1 `07-api-spec.md` full reconciliation with per-endpoint status
- [ ] T4.2 `08`, `09`, `10`

### Phase 5 — Operations and living docs

- [ ] T5.1 `12`, `13`, `14`
- [ ] T5.2 `15` (backend-first override), `CONTRIBUTING.md`, `README.md`
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

Phase 2 merged in PR #11. Phase 3 is complete on `docs/sdd-product` (T3.1-T3.3, 14 commits, all assessed passive against `develop`, so no review was due). Next: the user pushes and opens the PR into `develop`; then Phase 4 (contracts: `07`, `08`, `09`, `10`). Delegated work is split into slices of 300-500 lines. PR reviews use `develop` as base.
