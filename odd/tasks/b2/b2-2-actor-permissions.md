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

- [ ] T1 Re-verify where the application services check ownership and role today.
- [ ] T2 The `Actor` carries its permissions; a helper checks a permission and throws the existing authorization error.
- [ ] T3 Apply the checks to the portfolio, transaction, analytics and notification services, with allowed-role, denied-role and cross-user tests.
- [ ] T4 `VIEWER` self-service rules and escalation-attempt tests.
- [ ] T5 Reconcile `07-api-spec.md` (403 responses), `09-security-spec.md`, roadmap and PROGRESS.

## Done when

Authorization tests cover allowed role, denied role, cross-user access and escalation attempts (`09-security-spec.md` §55).

## Risk

Item 2 (security: permissions and guards) and item 3 for routes that start returning 403.

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B2 plan approved by the user on 2026-10-17.
