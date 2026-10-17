# B2.1 Roles and permission matrix

Source: roadmap B2 (`docs/BACKEND-ROADMAP.md`); ADR-005 points 1 and 2; `docs/09-security-spec.md` §12-13. Depends on: B0. Branch: `feat/b2-1-roles`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

## Allowed edit surfaces

packages/database/prisma/**
packages/database/src/**
packages/domain/src/**
packages/application/src/**
packages/persistence-memory/src/**
apps/api/src/**
docs/05-data-model.md
docs/09-security-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Specs

- S1 Roles are `VIEWER`, `TRADER` and `ADMIN`; the existing `USER` role migrates to `TRADER`. (ADR-005 point 1)
- S2 An explicit permission matrix maps each role to its permissions; code checks permissions and never role names. `VIEWER` reads own resources, may update its own preferences and mark its own notifications read, and mutates no domain data; `TRADER` has every supported mutation on own resources; `ADMIN` is `TRADER` plus `simulation:control` and nothing else. (ADR-005 points 2 and 13; `09-security-spec.md` §12-13)
- S3 The enum migration is hand-written (`RENAME VALUE 'USER' TO 'TRADER'`, `ADD VALUE 'VIEWER'`, updated default), because the generated one fails on existing rows. An old token carrying `role: "USER"` is rejected with 401. (roadmap B2, deferred detail)

## Findings from the exploration (2026-10-17)

- B0.5 already built the mechanism: `Actor` (`actor.ts`), `PERMISSIONS`, `ROLE_PERMISSIONS`, `hasPermission` and `assertPermission` (`permissions.ts`), and every application service already calls `assertPermission`. Today the matrix grants every permission to `USER` and `ADMIN`.
- `ANALYST` is not in the enum (only `USER` and `ADMIN`); dropping it is a docs adjustment.
- Permission names in code differ from the spec (`portfolio:write`, `notification:write`, `position:read`, `overview:read`, `preference:read` vs `portfolio:create/update/archive`, `notification:update`); `simulation:control` is missing. Decision: keep the code names and add `simulation:control`; the spec says a rename does not change the matrix.
- `authenticate.ts` already rejects with 401 a role that is not in `UserRole`, so a `USER` token is rejected once the enum changes.
- Where `USER`/`UserRole` is read: `packages/domain/src/entities/enums.ts`, `user.ts`, `packages/database/src/mappers/user-mapper.ts`, `packages/persistence-memory/src/in-memory-user-repository.ts` and its contract suite, `apps/api/src/middleware/authenticate.ts`, `apps/api/src/services/auth.service.ts`, `apps/api/src/test-utils/auth.ts` (`tokenFor` defaults to `USER`), the initial migration (`DEFAULT 'USER'`).
- B2.2 shrinks to the cross-user and escalation tests; decide at the end of B2.1 whether it stays a separate slice.

## Tasks

- [ ] T1 Domain: `UserRole` becomes `VIEWER`, `TRADER`, `ADMIN`; the default is `TRADER` in the in-memory repository, its contract suite and the Prisma mapper.
- [ ] T2 Prisma schema and the hand-written migration (`RENAME VALUE`, `ADD VALUE`, new default), tested on a database with existing rows. Its own commit.
- [ ] T3 The real matrix in `permissions.ts` (plus `simulation:control`), with a test per role and permission.
- [ ] T4 API tests: `tokenFor` defaults to `TRADER`; a token with `role: "USER"` is 401.
- [ ] T5 Reconcile `09-security-spec.md` §12-13, `05-data-model.md`, roadmap and PROGRESS.

## Done when

The three roles exist, existing users are `TRADER`, and the matrix has a test per role and permission.

## Risk

Items 1 (migration of stored data) and 2 (security): this slice gets an independent assessment and its own commit for the migration.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/persistence-memory test; pnpm --filter @trading/application test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B2 plan approved by the user on 2026-10-17: five slices, B2.1 first because everything else depends on the roles.
- 2026-10-17: the user approved the B2.1 plan above (T1 to T5) and the task files of B2 go in this branch's first commit instead of their own PR. Work resumes the next day with T1.
