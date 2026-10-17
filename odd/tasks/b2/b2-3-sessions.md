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

- [ ] T1 Re-verify the current login, the token signing and the `Clock` use.
- [ ] T2 `Session` entity, repository port, Prisma and in-memory adapters, and the migration, with the contract suite.
- [ ] T3 Token service: sign and verify the 15-minute JWT, reject unknown roles, with expired-token and wrong-signature tests written with the `Clock`.
- [ ] T4 Login creates a session and returns the new response shape; contracts and API tests.
- [ ] T5 Reconcile `05-data-model.md`, `07-api-spec.md` §9, `09-security-spec.md`, roadmap and PROGRESS.

## Done when

Login creates a hashed session and returns the new shape; expired and wrongly signed tokens are 401; the migration adds the sessions table without touching users.

## Risk

Items 1 (new migration), 2 (credentials and tokens) and 3 (the login response changes for its consumers).

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/persistence-memory test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B2 plan approved by the user on 2026-10-17.
