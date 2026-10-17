# B2.4 Refresh and logout

Source: roadmap B2 (`docs/BACKEND-ROADMAP.md`); ADR-005 points 5 to 7; FR-003; `docs/07-api-spec.md` §9. Depends on: B2.3. Branch: `feat/b2-4-refresh-logout`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/domain/src/**
packages/application/src/**
packages/contracts/src/**
packages/persistence-memory/src/**
apps/api/src/**
docs/07-api-spec.md
docs/09-security-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Specs

- S1 `POST /auth/refresh`: the refresh token travels in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie on `Path=/api/v1/auth` and is rotated on every use. Presenting an already-rotated token revokes the whole family. (ADR-005 points 5 to 7)
- S2 `POST /auth/logout` (FR-003, P0): the session is revoked and the cookie cleared; an issued access token stays valid until it expires, at most 15 minutes. (ADR-005)
- S3 Both endpoints require a custom request header. (ADR-005 points 5 to 7)
- S4 Parallel refreshes: a grace window of about 10 seconds in which the just-rotated token returns the same new pair, kept recoverable (encrypted at rest) for the window only; no revocation occurs inside it. (ADR-005)
- S5 `auth.logout` is logged at `info` with `userId` only, through the logger once B3 exists. (ADR-009 point 9)

## Tasks

- [ ] T1 Re-verify the session model from B2.3 and decide the `Secure` cookie on the local stack (serve on `localhost` or make `Secure` environment-dependent).
- [ ] T2 Application: refresh rotation, family revocation and the grace window, with a concurrent-refresh test and a lost-first-response test.
- [ ] T3 Application: logout.
- [ ] T4 Routes, cookie handling and the custom header check; API tests.
- [ ] T5 Reconcile `07-api-spec.md` §9, `09-security-spec.md`, roadmap and PROGRESS.

## Done when

Rotation, reuse detection, the grace window and logout are tested for the semantics above.

## Risk

Items 2 (credentials, sessions), 3 (new auth contract) and 4 (concurrent refreshes).

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- Created from the B2 plan approved by the user on 2026-10-17.
