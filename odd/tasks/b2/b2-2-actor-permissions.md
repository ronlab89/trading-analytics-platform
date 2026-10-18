# B2.2 Actor and permission checks

Source: roadmap B2 (`docs/BACKEND-ROADMAP.md`); ADR-005 points 3 and 13; `docs/09-security-spec.md`. Depends on: B2.1. Branch: `feat/b2-2-actor-permissions`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/domain/src/**
packages/application/src/**
packages/contracts/src/**
apps/api/src/**
docs/07-api-spec.md
docs/09-security-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Specs

- S1 Permission checks run through the `Actor` in the application layer and apply to the existing routes. Express middleware only authenticates and builds the `Actor`. (ADR-005 point 3)
- S2 A `VIEWER` may update its own preferences and mark its own notifications read, and mutates no domain data. `ADMIN` has `TRADER` plus `simulation:control` and nothing else in version 1. (ADR-005 point 13)

## Tasks

- [x] T1 Re-verify where the application services check ownership and role today. Result: all 16 services call `assertPermission(actor, ...)` in every use case, ownership reads as 404, and cross-user tests exist in 6 services and 11 route files.
- [x] T2 Dropped: the `Actor` and the permission helper already exist (B0.5) and B2.1 filled the matrix.
- [x] T3 Dropped: the checks are already applied to every service.
- [x] T4 `VIEWER` route tests (`apps/api/src/routes/viewer-role.routes.test.ts`): 403 on portfolio create, update and archive and on transaction create, 200 on reads, preferences and notifications, 401 for a forged ADMIN token.
- [x] T5 Reconcile `07-api-spec.md` (403 responses and the role-check statuses), roadmap and PROGRESS. `09-security-spec.md` was already reconciled in B2.1.

## Done when

Authorization tests cover allowed role, denied role, cross-user access and escalation attempts (`09-security-spec.md` §55).

## Risk

Item 2 (security: permissions and guards) and item 3 for routes that start returning 403.

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B2 plan approved by the user on 2026-10-17.
- 2026-10-18: B2.1 merged to develop. T1 showed B2.2 mostly done by B0.5 and B2.1, so T2 and T3 were dropped and the slice kept only the VIEWER route tests and the API spec. A first run failed because `exec vitest` skipped `dotenv`; the package `test` script loads `.env.test.local`. `POST /notifications/read-all` answers 204 by design. Not covered by a route test: VIEWER denial on scenarios, watchlist and alerts (the matrix and the service tests cover them).
