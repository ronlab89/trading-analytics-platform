# B2.1 Roles and permission matrix

Source: roadmap B2 (`docs/BACKEND-ROADMAP.md`); ADR-005 points 1 and 2; `docs/09-security-spec.md` §12-17. Depends on: B0. Branch: `feat/b2-1-roles`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/database/prisma/**
packages/domain/src/**
packages/application/src/**
packages/contracts/src/**
apps/api/src/**
docs/05-data-model.md
docs/09-security-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Specs

- S1 Roles are `VIEWER`, `TRADER` and `ADMIN`; the existing `USER` role migrates to `TRADER` and `ANALYST` is dropped. (ADR-005 point 1)
- S2 An explicit permission matrix maps each role to its permissions; code checks permissions and never role names. (ADR-005 point 2; `09-security-spec.md` §12-17)
- S3 `USER` to `TRADER` is a hand-written migration (`RENAME VALUE`, `ADD VALUE 'VIEWER'`, updated default), because the generated one fails on existing rows. (roadmap B2, deferred detail)

## Tasks

- [ ] T1 Re-verify the role enum, the seed and every place that reads a role name.
- [ ] T2 Domain: the `Role` values and the permission matrix as a pure map, with tests.
- [ ] T3 Hand-written migration `USER` to `TRADER` plus `VIEWER`, tested on a database with existing rows.
- [ ] T4 Adapt the seed, the token claims, the contracts and the API tests to the new roles.
- [ ] T5 Reconcile `05-data-model.md`, `09-security-spec.md`, roadmap and PROGRESS.

## Done when

The three roles exist, existing users are `TRADER`, `ANALYST` is gone, and the matrix has a test per role and permission.

## Risk

Items 1 (migration of stored data) and 2 (security): this slice gets an independent assessment and its own commit for the migration.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B2 plan approved by the user on 2026-10-17: five slices, B2.1 first because everything else depends on the roles.
