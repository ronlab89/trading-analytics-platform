# ADR-005: Roles, Permissions and Session Management

**Status:** Accepted
**Date:** 2026-10-04
**Implemented in:** roadmap block B2 (not yet implemented); permission checks
land with the application layer (B0, ADR-001)

## Context

Three role models coexist:

| Source | Roles |
|---|---|
| Code (`UserRole` in `schema.prisma`), `05-data-model.md` §5 | `USER`, `ADMIN` |
| `04-tech-stack.md` §24, `09-security-spec.md` §12 | `TRADER`, `ANALYST`, `ADMIN` |
| `12-demo-mode-spec.md` §56 | `Viewer`, `Trader`, `Admin` |

Only the demo model gives each role a distinct capability: read-only,
read plus mutations, and simulation control. `ANALYST` has no capability
that differs from any authenticated user, since every user reads analytics.
No route currently needs role restriction, so RBAC protects nothing today.

Session handling is incomplete:

- Login issues a 15-minute JWT (`JWT_EXPIRES_IN_SECONDS`, default 900) sent
  as a Bearer header. There is no refresh mechanism, so sessions end after
  15 minutes, and the response carries no expiry.
- There is no logout endpoint (FR-003, P0).
- `09-security-spec.md` §8 prefers HttpOnly cookies and §23 requires CSRF
  protection when cookies are used.

`12-demo-mode-spec.md` §57 forbids the demo from bypassing authorization.
Under ADR-001 the demo runs the application layer, so authorization must
live there rather than only in Express middleware.

## Decision

1. **Roles.** `VIEWER`, `TRADER`, `ADMIN`. The existing `USER` role is
   migrated to `TRADER`, which is what it represents today. `ANALYST` is
   dropped.
2. **Permissions.** An explicit permission matrix (for example
   `portfolio:read`, `transaction:create`, `simulation:control`). Roles are
   sets of permissions. Code checks permissions, never role names.
   - `VIEWER`: read permissions on own resources.
   - `TRADER`: `VIEWER` plus every supported mutation on own resources.
   - `ADMIN`: `TRADER` plus administrative and simulation-control
     permissions.
   The full matrix is maintained in `09-security-spec.md`.
3. **Enforcement point.** The application layer. Every use case receives an
   `Actor { userId, role }` and checks both permission and ownership. The API
   and the demo enforce identical rules. Express middleware only
   authenticates and builds the `Actor`.
4. **Access token.** A JWT valid for 15 minutes, sent as a Bearer header.
   The frontend keeps it in memory only, never in `localStorage` or
   `sessionStorage`.
5. **Refresh token.** An opaque random value, stored hashed in a sessions
   table. It travels in a cookie with `HttpOnly`, `Secure`,
   `SameSite=Strict` and `Path=/api/v1/auth`. It rotates on every use.
   Presenting an already-rotated token revokes the whole token family.
6. **Endpoints.** `POST /api/v1/auth/refresh` issues a new access token and
   rotates the refresh token. `POST /api/v1/auth/logout` revokes the session
   and clears the cookie. An access token already issued stays valid until
   it expires (at most 15 minutes); this is documented.
7. **CSRF.** The cookie reaches only the refresh and logout endpoints, uses
   `SameSite=Strict`, and those endpoints require a custom request header.
   This satisfies `09-security-spec.md` §23 without CSRF tokens.
8. **Login response.** `{ user, session: { accessToken, expiresAt } }`.
   Renaming the current `token` field is acceptable now because no client
   consumes the API yet.
9. **Role changes.** Take effect at the next refresh, within 15 minutes.
   `GET /auth/me` keeps reading the user from the database.
10. **Registration.** Out of scope. Users come from the seed; the demo uses a
    controlled identity (`12-demo-mode-spec.md` §55).
11. **Demo authentication.** A demo identity with a role selector
    (Viewer, Trader, Admin) that goes through the same permission checks.
12. **Existing behavior recorded.** Passwords are hashed with `bcryptjs`.
    Login is rate-limited to 5 attempts per 15 minutes. Access to another
    user's resource returns 404, never 403, so existence is not revealed.

## Consequences

**Positive**

- RBAC protects something real and is demonstrable in both modes.
- Sessions survive beyond 15 minutes without long-lived access tokens.
- Logout actually invalidates the session.
- Token theft through XSS is limited: the refresh token is unreadable from
  JavaScript and the access token is short-lived.

**Negative**

- A new sessions table and migration, plus a `UserRole` enum migration.
- The frontend needs a refresh flow (retry once on 401 after refreshing).
- Cookies require CORS with credentials for the web origin.

**Documents to align**

- `04-tech-stack.md` §24, `05-data-model.md` §5, `09-security-spec.md`
  §7-9 and §12-17 (roles, matrix, tokens, CSRF).
- `07-api-spec.md` §9 (login shape, refresh, logout).
- `12-demo-mode-spec.md` §55-57 (role names).

## Alternatives Considered

- **Access token only, longer lifetime, client-side logout.** Simplest, but
  logout invalidates nothing and a stolen token stays valid for hours.
  Rejected.
- **Server-side denylist of access tokens.** Adds a lookup on every request
  to get revocation that refresh rotation already provides. Rejected.
- **Access token in an HttpOnly cookie.** Requires CSRF protection on every
  state-changing route. Rejected in favor of limiting the cookie to the auth
  endpoints.
- **Keep `USER`/`ADMIN`.** No read-only role, so RBAC would still protect
  nothing meaningful. Rejected.

## Deferred detail

Implementation edge cases that do not change this decision. Each is
specified and tested in the listed block.

| Item | Resolution | Block |
|---|---|---|
| Parallel refreshes (tabs, retries, a lost response) present an already-rotated token and revoke a legitimate session. | Single-flight refresh in the client, plus a grace window of about 10 seconds in which the just-rotated token returns the same new pair. A concurrent-refresh test covers it. | B2 |
| The grace window must return the same successor refresh token, but refresh tokens are stored only as hashes, so the plaintext cannot be re-sent. | Keep the successor refresh token recoverable for the grace window only (encrypted at rest in the sessions table, cleared when the window ends), and re-send it in the grace response. Re-sending only a new access token is not acceptable: if the first rotation response was lost, the browser would be left without a valid refresh token. Tests cover parallel refreshes and a lost first response, and prove no revocation occurs. | B2 |
| The refresh token family and its cookie have no lifetime. | An idle timeout and an absolute family lifetime (`expiresAt` in the sessions table, cookie `Max-Age`). | B2 |
| `USER` → `TRADER` enum migration: Prisma's generated migration recreates the enum and fails on existing rows, `@default(USER)` breaks, and old JWTs carry `role: "USER"`. | A hand-written migration with `RENAME VALUE 'USER' TO 'TRADER'` and `ADD VALUE 'VIEWER'`, an updated default, and unknown roles rejected with 401. | B2 |
| The `Secure` cookie on the local production stack has no HTTPS. | Serve on `localhost`, which browsers treat as secure, and document it; or make `Secure` environment-dependent. | B2 |

## Related

- ADR-001 (application layer, enforcement point)
- `09-security-spec.md`, `12-demo-mode-spec.md` §55-57
- FR-003 (logout)
