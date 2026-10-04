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

- [ ] T1.1 `docs/README.md` (index, precedence, status legend, maintenance rule)
- [ ] T1.2 `docs/adr/` template + accepted ADRs
- [ ] T1.3 Mechanical normalization (headers, cross-refs, code fences)
- [ ] T1.4 `docs:check` cross-reference script

### Phase 2 — Foundations

- [ ] T2.1 `00-overview.md`, `04-tech-stack.md`
- [ ] T2.2 `05-data-model.md` regenerated against `schema.prisma`
- [ ] T2.3 `06-architecture.md` rewritten (real monorepo + ADR-001)
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
- 2026-10-04: ADR-008 committed (`bc94ca0`); ADR-009 committed (see git log). Phase 0 complete.

## Next step

Phase 0 complete. Next: Phase 1 (governance) — T1.1 `docs/README.md`, T1.2 ADR template and index, T1.3 mechanical normalization, T1.4 `docs:check` script. Route: delegated writer (multiple non-trivial files).
