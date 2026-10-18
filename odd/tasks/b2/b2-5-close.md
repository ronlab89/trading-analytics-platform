# B2.5 Security review and close

Source: roadmap B2 (`docs/BACKEND-ROADMAP.md`); `docs/15-implementation-plan.md` §33; `docs/09-security-spec.md`. Depends on: B2.1 to B2.4. Branch: `docs/close-b2`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

docs/**
odd/tasks/b2/**

## Specs

- S1 The auth-focused security review (decided 2026-10-08) covers sessions, roles, permissions and token handling, against the checks of `15-implementation-plan.md` §33 that concern them. B7 owns the final pass.
- S2 The SDD role model is reconciled.

## Tasks

- [x] T1 Run the review against the §33 checks and record each result (see "Security review results").
- [ ] T2 Flip the `Planned (B2)` marks across the docs, after checking each against the code.
- [ ] T3 Close B2 in the roadmap and PROGRESS.

## Security review results

Reviewed on 2026-10-18 against `develop` after B2.4, by reading the code and tests (not the docs). B7 owns the final pass.

| §33 item       | Result             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication | Meets              | The 44 data routes and `GET /auth/me` go through `authenticate`; only `login`, `refresh` and `logout` are public, on purpose, and `health` is outside. The JWT pins HS256 (`token.service.ts`), takes `iat` and `exp` from the `Clock` and rejects unknown roles. The refresh token is stored only as a hash, rotates, detects reuse and has a grace window (`refresh.service.test.ts`, `auth.refresh.routes.test.ts`). |
| Authorization  | Meets              | All 16 application services call `assertPermission`. The matrix is tested per role, `VIEWER` gets 403 on mutations (`viewer-role.routes.test.ts`), and another user's resource is a 404 (tests in 19 route files).                                                                                                                                                                                                      |
| CORS           | Meets              | `credentials: true` over an explicit origin list; a wildcard is rejected at startup (`env.test.ts`); a preflight test covers the header.                                                                                                                                                                                                                                                                                |
| Secrets        | Meets for B2       | `JWT_SECRET` needs 32 characters or the API does not start; the grace key is derived with HKDF, so no new secret exists; `.env` files are gitignored. `DATABASE_URL` validation is B7.                                                                                                                                                                                                                                  |
| Rate limiting  | Meets, with a note | Login: 5 per 15 minutes per IP; the rest: the general limiter. Refresh has no limiter of its own.                                                                                                                                                                                                                                                                                                                       |
| Error exposure | Meets for B2       | Every login failure has one message, every refresh failure is `Invalid refresh token.`. Log redaction is B3.                                                                                                                                                                                                                                                                                                            |

Observations, none a defect of B2 and none opens a slice:

1. The last rotated row of a family that never refreshes again keeps its encrypted successor until logout or revocation; the idle timeout leaves the token unusable.
2. `authenticate` trusts the role claim of the JWT for up to 15 minutes; refresh reads the role from the database (ADR-005 point 9).
3. Refresh has no dedicated rate limiter (the open detail of `09-security-spec.md` §26 stays open).

## Done when

The review is recorded, the role model is reconciled and no `Planned (B2)` mark is stale.

## Risk

None (documentation only), unless the review finds a defect, which becomes its own slice.

## Verification

pnpm docs:check.

## Log

- Created from the B2 plan approved by the user on 2026-10-17.
- 2026-10-18: T1 done. The review found no defect; evidence gathered with greps over the routers, the application services and the tests, and recorded above.
