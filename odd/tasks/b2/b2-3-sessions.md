# B2.3 Sessions and the new login response

Source: roadmap B2 (`docs/BACKEND-ROADMAP.md`); ADR-005 points 4, 8 and 9; `docs/07-api-spec.md` §9. Depends on: B2.1. Branch: `feat/b2-3-sessions`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/database/prisma/**
packages/domain/src/**
packages/application/src/**
packages/contracts/src/**
packages/persistence-memory/src/**
apps/api/src/**
docs/05-data-model.md
docs/07-api-spec.md
docs/09-security-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Specs

- S1 Login returns `{ user, session: { accessToken, expiresAt } }`; the access token is a 15-minute JWT sent as a Bearer header. (ADR-005 points 4 and 8)
- S2 The refresh token is an opaque value stored hashed in a sessions table, with an idle timeout and an absolute lifetime (`expiresAt`). (ADR-005; roadmap B2, deferred detail)
- S3 Role changes take effect at the next refresh; an unknown role in an old token is rejected with 401. (ADR-005 point 9)

## Tasks

- [x] T1 Re-verify the current login, the token signing and the `Clock` use. Result: the login signed with `jwt.sign` directly and did not use the `Clock`; there was no `Session` and no response schema; no client consumed `session.token`.
- [x] T2 `Session` entity, repository port, in-memory and Prisma adapters, the migration and the contract suite. Done as T2a (domain), T2b (in-memory and contract suite) and T2c (Prisma and migration `20261018130000_add_session_table`, own commit).
- [x] T3 Token service (`apps/api/src/services/token.service.ts`): signs and verifies the 15-minute JWT with the `Clock`, pins HS256, rejects unknown roles; expiry, signature, algorithm and role tests.
- [x] T4 Done as T4a (shared `accessTokens` instance, `clock.ts`, `authenticate` verifies through the service, `SESSION_*` settings) and T4b (login creates a hashed session, sets the cookie and returns `{ user, session: { accessToken, expiresAt } }`; `loginResponseSchema` in contracts; API tests).
- [x] T5 Reconcile `05-data-model.md` §5.3, `07-api-spec.md` §9, `09-security-spec.md` §6-8, roadmap and PROGRESS.

## Done when

Login creates a hashed session and returns the new shape; expired and wrongly signed tokens are 401; the migration adds the sessions table without touching users.

## Risk

Items 1 (new migration), 2 (credentials and tokens) and 3 (the login response changes for its consumers).

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/persistence-memory test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B2 plan approved by the user on 2026-10-17.
- 2026-10-18: built on the branch of B2.2 (`feat/b2-2-actor-permissions`) at the user's request, so the PR covers B2.2 and B2.3. Decisions: idle timeout 7 days and absolute lifetime 30 days (`SESSION_IDLE_SECONDS`, `SESSION_ABSOLUTE_SECONDS`, both with defaults); the idle timeout is `lastUsedAt` plus the setting, not stored; the table keeps only the columns B2.3 needs (grace-window columns come with B2.4 in a second migration); `systemClock` moved to `apps/api/src/clock.ts` so `authenticate` does not load Prisma. Two things not done on purpose: `.env.example` and `.env.test.example` do not list the two new settings (a deny rule blocks `.env.example`; both have defaults), and `14-deployment-spec.md` still lists only the old variables.
