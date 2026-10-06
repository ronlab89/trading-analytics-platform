# SDD 09 — Security Specification

**Project:** Trading Analytics Platform  
**Status:** Draft  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`, `05-data-model.md`, `06-architecture.md`, `07-api-spec.md`, `08-realtime-spec.md`

---

# 1. Purpose

**Status:** `Reference`

This document owns the security requirements of Trading Analytics Platform:
authentication, sessions, authorization, validation, transport, realtime,
data, logging and the demo's security boundary. It also holds the role and
permission matrix (§13), as ADR-005 point 2 requires.

The decisions behind it are ADR-005 (roles, permissions and sessions),
ADR-001 (the application layer as the enforcement point), ADR-002 (error
codes), ADR-007 (realtime authentication) and ADR-006 (deployment model).
The measurable targets are NFR-019 to NFR-028 in
`03-non-functional-requirements.md`.

Security is a cross-cutting concern across:

- authentication and session management;
- authorization;
- API and realtime communication;
- data access and validation;
- frontend behavior;
- database access;
- error handling and logging;
- deployment.

The implementation demonstrates realistic security practices without
unnecessary infrastructure or paid third-party services.

---

# 2. Security Principles

**Status:** `Reference`

1. Never trust the client.
2. Validate all external input.
3. Authorize every protected resource server-side, in the application layer
   (ADR-005 point 3).
4. Apply least privilege.
5. Keep authentication separate from authorization.
6. Keep domain logic independent from infrastructure.
7. Never expose secrets to the frontend.
8. Fail securely.
9. Avoid leaking sensitive information through errors, including whether
   another user's resource exists (ADR-005 point 12).
10. Keep security mechanisms testable.
11. Prefer simple, explicit security boundaries.
12. Use defense in depth.
13. Enforce identical rules in the API and the demo (ADR-005 point 3,
    `12-demo-mode-spec.md` §57).

---

# 3. Security Architecture

**Status:** HTTP pipeline `Implemented` (`apps/api/src/app.ts`); enforcement in the application layer `Planned (B0)` (ADR-001); realtime flow `Planned (B5)` (ADR-007)

Target HTTP flow (ADR-001, ADR-005 point 3):

```text
Client
  ↓
Transport (HTTPS where the deployment provides it)
  ↓
API: security headers, CORS, request ID, rate limit
  ↓
Authentication middleware → builds Actor { userId, role }
  ↓
Validation
  ↓
Application use case → permission + ownership check
  ↓
Domain
  ↓
Repository
  ↓
Database
```

Code today: `helmet`, CORS restricted to `CORS_ORIGIN`, the request ID and
the general rate limiter run in that order (`apps/api/src/app.ts`). Each
route then runs `authenticate` and `validate`, and the service in
`apps/api/src/services/` checks ownership. There is no application layer
and no permission check yet; ADR-001 moves the services into
`@trading/application` in B0, and the use cases take an `Actor` instead of a
bare `userId`.

Transport: the backend runs locally only and has no HTTPS; the public demo
is a static build served by its host (ADR-006 points 1-2). A public backend
behind HTTPS and WSS is `Deferred` until a new ADR.

Realtime flow (ADR-007 points 2-3):

```text
Client
  ↓
WebSocket connection (no token in the URL)
  ↓
AUTHENTICATE message within 5 seconds
  ↓
Channel authorization (permission + ownership, application layer)
  ↓
Validated events
  ↓
Application state
```

---

# 4. Threat Model

**Status:** `Reference`

The application considers at minimum the threats below. It addresses
realistic risks rather than every enterprise control.

| Threat | Main control | Section |
| --- | --- | --- |
| Unauthorized access | Bearer access token on every protected route | §5, §16 |
| Token theft | 15-minute access token in memory; refresh token in an `HttpOnly` cookie | §7, §8 |
| Session abuse | Refresh rotation, reuse detection, server-side logout | §7, §9 |
| Privilege escalation | Permission matrix checked in the application layer | §12, §13 |
| Insecure direct object references | Ownership check; another user's resource is 404 | §14, §15 |
| Malformed requests | Schema validation | §18-§20 |
| Injection attacks | Parameterized queries through Prisma | §21 |
| Cross-site scripting | No raw HTML rendering; token not readable from storage | §22 |
| CSRF | Cookie limited to auth endpoints, `SameSite=Strict`, custom header | §23 |
| WebSocket abuse | Socket authentication, subscription limits, inbound rate limit | §31-§35 |
| Excessive request volume | Rate limiting | §26 |
| Sensitive information disclosure | Generic errors, log redaction | §28, §49 |
| Replayed events | Per-channel `sequence`, stale-event protection | §34 |
| Demo manipulation | Demo runs the same permission checks | §41 |
| Compromised client-side state | The client is not a security boundary | §46, §47 |

---

# 5. Authentication

**Status:** login and current user `Implemented` (`apps/api/src/services/auth.service.ts`); refresh and logout `Planned (B2)` (ADR-005 points 5-6; FR-001, FR-002, FR-083)

Authentication verifies the identity of the user. It runs on the backend;
the frontend never decides whether a user is genuinely authenticated.

```text
Email + password
    ↓
POST /api/v1/auth/login (rate-limited, validated)
    ↓
bcrypt comparison against the Credential table
    ↓
Access token (JWT, 15 minutes)        ← Implemented
+ refresh token cookie (opaque)       ← Planned (B2)
    ↓
Authenticated session
```

Implemented today:

- Passwords are hashed with `bcryptjs`; credentials live in a separate
  `Credential` table (`auth.service.ts`, NFR-019).
- Every credential failure returns the same 401 `UNAUTHORIZED`
  `Invalid credentials.`, so accounts cannot be enumerated (FR-001, §51).
- Login is limited to 5 attempts per 15 minutes per IP
  (`apps/api/src/middleware/rate-limit.ts`, ADR-005 point 12).
- `GET /api/v1/auth/me` reads the user from the database on every call.

There is no self-registration; users come from the seed (ADR-005 point 10).
The demo uses a controlled demo identity with a role selector that goes
through the same permission checks (ADR-005 point 11, `Planned (FE)`).

---

# 6. JWT Strategy

**Status:** `Implemented` (`apps/api/src/services/auth.service.ts`, `apps/api/src/middleware/authenticate.ts`); unknown-role rejection `Planned (B2)` (ADR-005 Deferred detail)

The JWT is the access token. It carries only what identifies the session:

```text
{
  sub: userId,
  role: role,
  iat: issuedAt,
  exp: expiration
}
```

- Signed with HMAC using `JWT_SECRET`, which must be at least 32 characters
  or the API refuses to start (`apps/api/src/config/env.ts`, NFR-019).
- Sensitive information is never stored in the payload.
- The `role` claim is a hint for the session; `GET /auth/me` and, from B2,
  every refresh read the role from the database (ADR-005 point 9).

Code today: `authenticate` accepts any string as `role`. ADR-005 (Deferred
detail, B2) requires a token carrying an unknown role, such as an old
`USER` token after the enum migration, to be rejected with 401 (FR-083).

> Open detail (B2): `jwt.verify` does not pin the accepted algorithm. B2
> passes `algorithms: ["HS256"]` explicitly so a future key change cannot
> widen what is accepted.

---

# 7. Token Lifetime

**Status:** access token `Implemented` (`JWT_EXPIRES_IN_SECONDS`, default 900); refresh token lifecycle `Planned (B2)` (ADR-005 points 4-6 and Deferred detail; FR-083)

| Token | Lifetime | Status |
| --- | --- | --- |
| Access token (JWT) | 15 minutes | `Implemented` |
| Refresh token | Rotates on every use; idle timeout and absolute family lifetime | `Planned (B2)` |

Refresh token rules (ADR-005 point 5):

- An opaque random value, stored hashed in a sessions table.
- `POST /api/v1/auth/refresh` issues a new access token and rotates the
  refresh token.
- Presenting an already-rotated token revokes the whole token family, and
  `auth.refresh.reuse_detected` is logged (FR-083, ADR-009 point 9).
- Role changes take effect at the next refresh, within 15 minutes
  (ADR-005 point 9).

Code today: there is no refresh mechanism, so a session ends when the
access token expires, and the login response carries no expiry. ADR-005
point 8 changes the response to
`{ user, session: { accessToken, expiresAt } }` in B2.

> Open detail (B2, ADR-005 Deferred detail): parallel refreshes are handled
> by a client single-flight refresh plus a grace window of about 10 seconds
> that returns the same successor pair. The successor refresh token stays
> recoverable (encrypted at rest) only for that window.

> Open detail (B2, ADR-005 Deferred detail): the idle timeout and absolute
> family lifetime are stored as `expiresAt` in the sessions table and as the
> cookie `Max-Age`. The concrete durations are fixed in B2.

---

# 8. Token Storage

**Status:** `Planned (B2)` (server cookie); `Planned (FE)` (client memory) (ADR-005 points 4, 5, 7; NFR-028)

| Credential | Where | Rule |
| --- | --- | --- |
| Access token | Client memory only | Never `localStorage` or `sessionStorage` |
| Refresh token | Cookie | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth` |

The access token travels as `Authorization: Bearer <accessToken>`
(`Implemented`, `authenticate.ts`). It is not stored in a cookie, so
state-changing routes need no CSRF tokens; the refresh cookie reaches only
the refresh and logout endpoints, which require a custom request header
(ADR-005 point 7, §23).

Code today: no cookie is set; the client stores nothing because no client
consumes the API yet.

> Open detail (B2, ADR-005 Deferred detail): the local production stack
> has no HTTPS. The API is served on `localhost`, which browsers treat as
> secure, or `Secure` becomes environment-dependent; B2 documents the
> choice.

> Open detail (B2): the custom header's name and the CORS configuration
> with credentials for the web origin (ADR-005 Consequences) are fixed in
> B2 and recorded in `07-api-spec.md` §9.

---

# 9. Logout

**Status:** `Planned (B2)` (endpoint); `Planned (FE)` (client) (ADR-005 points 6-7; FR-003)

`POST /api/v1/auth/logout`, with the required custom header, revokes the
session's refresh-token family and clears the cookie. A request without
the header is rejected and the session is not revoked.

An access token already issued stays valid until it expires, at most 15
minutes. This is documented behavior, not a defect (ADR-005 point 6,
NFR-019). There is no server-side access-token denylist (ADR-005,
Alternatives Considered).

On logout the frontend:

- discards the in-memory access token;
- disconnects realtime subscriptions;
- clears user-specific cached data;
- redirects to login (in the demo, to the demo identity selector).

Data from the previous session never remains visible after logout,
including through back navigation (FR-003).

Code today: there is no logout endpoint (`apps/api/src/routes/auth.routes.ts`
has login and `me` only).

---

# 10. Session Isolation

**Status:** `Planned (FE)` (FR-003)

User-specific client state is isolated per session:

```text
User A
  ↓
Logout
  ↓
Clear session (access token, refresh cookie revoked)
  ↓
Clear User A state
  ↓
User B
  ↓
New session
```

User B never inherits:

- cached queries;
- portfolio data;
- realtime subscriptions;
- notifications;
- simulation state;
- permissions.

The same applies when the demo switches its demo identity or role
(ADR-005 point 11).

---

# 11. Authorization

**Status:** ownership checks `Implemented` (`apps/api/src/services/`); permission checks `Planned (B0)` mechanism, `Planned (B2)` roles (ADR-005 points 2-3, ADR-001; NFR-020, FR-084)

Authorization determines what an authenticated actor may do. It is decided
in the application layer: every use case receives an `Actor { userId, role }`
and checks both permission (§13) and ownership (§14). Express middleware
only authenticates and builds the `Actor` (ADR-005 point 3). The demo runs
the same use cases, so it enforces identical rules (`12-demo-mode-spec.md`
§57).

The frontend may hide unavailable actions for UX, but this is not a
security mechanism (§47).

Code today: services in `apps/api/src/services/` receive a bare `userId`
and check ownership only; no route checks a role.

---

# 12. RBAC

**Status:** `Planned (B2)` (ADR-005 point 1; FR-084)

Roles:

| Role | Meaning |
| --- | --- |
| `VIEWER` | Reads own resources; performs no mutation |
| `TRADER` | `VIEWER` plus every supported mutation on own resources |
| `ADMIN` | `TRADER` plus administrative and simulation-control permissions |

`ANALYST` is dropped: it had no capability distinct from any authenticated
user (ADR-005 Context). Roles are sets of permissions; code checks
permissions, never role names (ADR-005 point 2).

Code today: `UserRole` in `packages/database/prisma/schema.prisma` is
`USER`, `ADMIN`, with `@default(USER)`. ADR-005 requires `VIEWER`,
`TRADER`, `ADMIN`, with `USER` migrated to `TRADER` (B2).

> Open detail (B2, ADR-005 Deferred detail): the enum migration is
> hand-written (`RENAME VALUE 'USER' TO 'TRADER'`, `ADD VALUE 'VIEWER'`),
> updates the default, and old tokens carrying `role: "USER"` are rejected
> with 401 (§6).

---

# 13. Permission Model

**Status:** `Planned (B2)` (ADR-005 point 2; FR-084); permission checks run in the application layer from B0 (ADR-001)

Authorization follows:

```text
Actor (userId, role)
 ↓
Role → set of permissions
 ↓
Permission required by the use case (resource:action)
 ↓
Ownership of the target resource (§14)
 ↓
ALLOW | DENY
```

Permission matrix (ADR-005 point 2). Permissions are named
`resource:action`. "Own" means the resource belongs to the actor (§14);
market data and assets are shared reference data with no owner.

| Permission | Scope | `VIEWER` | `TRADER` | `ADMIN` |
| --- | --- | --- | --- | --- |
| `portfolio:read` | Own | ✅ | ✅ | ✅ |
| `portfolio:create`, `portfolio:update`, `portfolio:archive` | Own | — | ✅ | ✅ |
| `transaction:read` | Own | ✅ | ✅ | ✅ |
| `transaction:create`, `transaction:import` | Own | — | ✅ | ✅ |
| `analytics:read` | Own | ✅ | ✅ | ✅ |
| `decision:read`, `scenario:read` | Own | ✅ | ✅ | ✅ |
| `decision:write`, `scenario:write` | Own | — | ✅ | ✅ |
| `watchlist:read`, `alert:read` | Own | ✅ | ✅ | ✅ |
| `watchlist:write`, `alert:write` | Own | — | ✅ | ✅ |
| `notification:read` | Own | ✅ | ✅ | ✅ |
| `market:read`, `asset:read` | Shared | ✅ | ✅ | ✅ |
| `simulation:control` | Global | — | — | ✅ |

`simulation:control` guards `POST /api/v1/simulation/start`,
`POST /api/v1/simulation/pause` and `PUT /api/v1/simulation/mode`
(ADR-007 points 10 and 15, `Planned (B5)`).

> Pending decision: whether a `VIEWER` may change its own preferences
> (`PATCH /api/v1/preferences`) and notification read state. These are
> user-scoped self-service mutations; ADR-005 point 2 denies a `VIEWER`
> "every mutation" without addressing them. Until decided, the matrix
> omits `preference:write` and `notification:update`.

> Pending decision: ADR-005 point 2 grants `ADMIN` "administrative"
> permissions, but no administrative endpoint exists or is planned besides
> simulation control. The matrix lists only `simulation:control` until one
> is defined.

> Open detail (B2): the exact permission names per endpoint are fixed with
> the B2 authorization tests (§55); renaming a permission does not change
> this matrix.

---

# 14. Resource Ownership

**Status:** `Implemented` (`apps/api/src/services/`, for example `portfolio.service.ts`); `Actor`-based checks `Planned (B0)` (ADR-001, ADR-005 point 3; NFR-020)

A permission alone is insufficient. An actor may hold `portfolio:read` and
still not own a specific portfolio. Every use case validates:

```text
Role permission
+
Resource ownership
```

```text
User A → portfolio:read → portfolio belongs to User A → ALLOW
User A → portfolio:read → portfolio belongs to User B → DENY (404)
```

Ownership is resolved from the owning portfolio or user, never from data
the client supplies. Child resources (positions, transactions, decisions,
scenarios, imports) are checked through their portfolio.

Realtime subscriptions follow the same rule: `portfolio:{portfolioId}` of
another user is denied, and `notifications` is scoped to the authenticated
user (ADR-007 point 3, FR-086, `Planned (B5)`).

---

# 15. IDOR Protection

**Status:** `Implemented` (cross-user tests in `apps/api/src/routes/*.routes.test.ts`, for example `portfolios.routes.test.ts`; ADR-005 point 12; NFR-020)

Knowing a resource ID never grants access. For a request such as:

```text
GET /api/v1/portfolios/:portfolioId
```

the backend verifies ownership. A resource that does not exist and a
resource that belongs to another user return the same 404 `NOT_FOUND`
`The requested resource could not be found.`, never 403, so the existence of
another user's resource is not revealed (ADR-005 point 12,
`portfolio.service.ts`).

---

# 16. Authentication Middleware

**Status:** `Implemented` (`apps/api/src/middleware/authenticate.ts`); `Actor` construction `Planned (B0)` (ADR-001, ADR-005 point 3)

Protected API routes follow:

```text
Request
 ↓
authenticate (verifies the Bearer token, builds the Actor)
 ↓
validate (request schema)
 ↓
Controller
 ↓
Application use case (permission + ownership)
```

Authentication and authorization stay separate: the middleware only
authenticates. There is no authorization middleware; permission checks
live in the application layer so the API and the demo share them
(ADR-005 point 3). This supersedes the `requireRole` / permission
middleware named in `BACKEND-ROADMAP.md` B2.

Code today: `authenticate` attaches `req.auth = { userId, role }` and
rejects every failure (missing or malformed header, invalid signature,
expiry, malformed payload) with the same 401 `Authentication required.`.

---

# 17. Authorization Failure

**Status:** 401 and 404 `Implemented`; 403 `Planned (B2)` (ADR-002 point 10, ADR-005 points 2 and 12); socket close codes `Planned (B5)` (ADR-007 point 15)

| Situation | Response | Status |
| --- | --- | --- |
| Not authenticated: missing, invalid or expired token | 401 `UNAUTHORIZED` `Authentication required.` | `Implemented` |
| Invalid credentials at login | 401 `UNAUTHORIZED` `Invalid credentials.` | `Implemented` |
| Token carrying an unknown role | 401 `UNAUTHORIZED` | `Planned (B2)` |
| Missing, revoked or expired refresh token | 401 `UNAUTHORIZED` | `Planned (B2)` |
| Authenticated, own resource, missing permission | 403 `FORBIDDEN` | `Planned (B2)` |
| Another user's resource, or a missing one | 404 `NOT_FOUND` | `Implemented` |

`FORBIDDEN` is declared in `AppErrorCode`
(`apps/api/src/errors/app-error.ts`) but not raised today. Error bodies
follow `07-api-spec.md` §5-6 and expose no authorization details: no
required permission, no role, and no hint of which check failed.

Realtime equivalents (ADR-007 point 15): close code `4001` for an
unauthenticated or invalid token, including the 5-second authentication
timeout; `4002` for an expired token. A denied subscription is answered
with an `ERROR` reply carrying a `code` and is logged as `authz.denied`
(`08-realtime-spec.md` §9, ADR-009 point 9). The `ERROR` code set is an
Open detail (B5) owned by `08-realtime-spec.md` §9.

---

# 18. Input Validation

All external input must be validated.

Sources include:

- request body;
- query parameters;
- route parameters;
- headers;
- WebSocket events;
- environment variables.

Zod will be used for schema validation where appropriate.

---

# 19. Validation Strategy

The validation pipeline is:

```text
External Input
      ↓
Schema Validation
      ↓
Normalized Input
      ↓
Application Service
      ↓
Domain Validation
```

Transport validation must not replace business-rule validation.

Both are required.

---

# 20. Domain Validation

Business rules must remain inside the application/domain layer.

Example:

A request may be structurally valid:

```text
quantity = 100
price = 150
```

but still be invalid because:

```text
portfolio does not have sufficient available balance
```

Such rules must not be implemented only inside the controller.

---

# 21. Injection Protection

The application must protect against:

- SQL injection;
- command injection;
- NoSQL injection where applicable;
- header injection;
- unsafe dynamic queries.

Parameterized/type-safe database access through Prisma must be used.

Raw SQL should only be introduced when necessary and must use safe parameterization.

---

# 22. XSS Protection

User-controlled content must not be rendered as executable HTML.

The frontend must avoid unnecessary use of:

```text
dangerouslySetInnerHTML
```

If HTML rendering becomes necessary, content must be sanitized using an appropriate maintained library.

---

# 23. CSRF

The CSRF strategy depends on the authentication transport.

If authentication uses cookies, the application must implement appropriate CSRF protection for state-changing requests.

SameSite cookie policies should provide an additional defense layer.

---

# 24. CORS

The API must use an explicit CORS allowlist.

Development and production origins must be configurable.

The application must not use unrestricted:

```text
Access-Control-Allow-Origin: *
```

for authenticated production endpoints.

---

# 25. HTTP Security Headers

The backend should provide appropriate security headers.

Relevant protections include:

- Content Security Policy;
- X-Content-Type-Options;
- Referrer-Policy;
- frame protection;
- strict transport security in HTTPS environments.

A maintained security middleware may be used where appropriate.

---

# 26. Rate Limiting

Sensitive and abuse-prone endpoints should have rate limiting.

Priority endpoints include:

- authentication;
- login;
- password-related operations;
- expensive analytics operations;
- administrative endpoints.

The rate-limiting strategy must remain compatible with free-tier deployment.

---

# 27. Request Size Limits

The API must define reasonable limits for:

- request body size;
- query length;
- pagination parameters;
- batch operations.

This reduces unnecessary resource consumption and denial-of-service exposure.

---

# 28. API Error Security

Errors returned to clients must not expose:

- stack traces;
- database connection details;
- filesystem paths;
- environment variables;
- secrets;
- internal service information.

Production responses should expose safe error messages.

---

# 29. Error Structure

The API should use a consistent error format.

Example:

```text
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource could not be found.",
    "requestId": "req_123"
  }
}
```

Internal logs may contain additional diagnostic information.

---

# 30. Request IDs

Each API request should receive a request identifier.

Example:

```text
requestId
```

The identifier should be available in:

- logs;
- error responses;
- diagnostic tooling.

This allows failures to be traced without exposing sensitive information.

---

# 31. Realtime Security

WebSocket connections must be authenticated.

After connection:

```text
WebSocket
   ↓
Authenticate
   ↓
Establish Identity
   ↓
Authorize Subscription
```

The client must not be allowed to subscribe to arbitrary channels.

---

# 32. Channel Authorization

Example:

```text
portfolio:portfolio_123
```

The server must verify that the authenticated user is allowed to access that portfolio.

Knowing the channel name must not grant access.

---

# 33. Realtime Event Validation

Incoming realtime events must be validated.

The server must not trust:

```text
event.type
event.payload
event.metadata
```

without validation.

Invalid events should be rejected.

---

# 34. Realtime Event Integrity

Events should contain enough metadata to support:

- deduplication;
- ordering;
- replay detection;
- consistency checks.

Sequence numbers and event IDs should be validated according to the realtime specification.

---

# 35. Realtime Rate Protection

High-frequency event streams must have controlled limits.

The backend should prevent a client from:

- creating unlimited subscriptions;
- opening excessive connections;
- sending uncontrolled messages;
- subscribing to unnecessary channels.

---

# 36. Database Security

Database access must occur only through backend infrastructure.

The frontend must never connect directly to PostgreSQL.

Architecture:

```text
Browser
  X
  │
  └── PostgreSQL

Browser
  ↓
API
  ↓
Repository
  ↓
Prisma
  ↓
PostgreSQL
```

---

# 37. Database Credentials

Database credentials must exist only on the server.

They must never be:

- committed;
- returned through an API;
- embedded into frontend builds;
- included in mock data;
- written to logs.

---

# 38. Least Privilege

Infrastructure credentials should have only the permissions they require.

The application database user should not automatically have unrestricted administrative privileges.

Development and production credentials must be separated.

---

# 39. Sensitive Data

The system should minimize stored sensitive information.

The application does not need real financial account credentials or real banking information.

The demo must use synthetic data.

---

# 40. Financial Data Boundary

Trading Analytics Platform is a portfolio engineering project.

It must not store or process real brokerage credentials.

No real:

- API keys;
- bank credentials;
- brokerage credentials;
- payment credentials;
- private trading account information

should be required by the demo.

---

# 41. Demo Mode Security

Demo Mode must operate using synthetic identities and data.

The demo should never request real:

- passwords;
- financial credentials;
- API keys;
- brokerage tokens.

The simulation environment must be clearly separated from production infrastructure.

---

# 42. Mock Data

Mock data must contain no real personal information.

Examples should use synthetic:

```text
users
portfolios
transactions
assets
notifications
market events
```

Identifiers should also be synthetic.

---

# 43. Secrets Management

Secrets must be provided through environment configuration.

Example:

```text
JWT_SECRET
DATABASE_URL
```

Environment files containing secrets must not be committed.

A safe example configuration may be committed:

```text
.env.example
```

but must contain placeholders only.

---

# 44. Dependency Security

Dependencies should be:

- actively maintained;
- from trusted sources;
- kept reasonably current;
- reviewed before introduction.

Security updates should be prioritized.

The project should periodically run dependency vulnerability checks.

---

# 45. Dependency Policy

A dependency should not be introduced only because it provides a convenient shortcut around understanding the security boundary.

Security-critical behavior should remain understandable and testable.

Examples:

```text
JWT verification
Authorization rules
Resource ownership
Input validation
```

must have explicit tests.

---

# 46. Frontend Security Boundary

The frontend is considered untrusted.

The following must never be trusted from frontend state:

```text
role
permissions
portfolio ownership
prices
transaction authorization
administrative status
```

The backend remains authoritative.

---

# 47. Client-Side Role Checks

Frontend authorization checks are allowed for UX:

```text
if user.role === ADMIN
    show Admin action
```

But the backend must independently verify authorization.

A malicious user modifying frontend state must not gain additional privileges.

---

# 48. Sensitive Information in URLs

Sensitive information must not be placed unnecessarily in:

- query strings;
- route parameters;
- browser history.

Authentication credentials and secrets must never be included in URLs.

---

# 49. Logging Security

Logs must not contain:

- passwords;
- JWT secrets;
- access tokens;
- refresh tokens;
- database credentials;
- private credentials.

Sensitive identifiers should be redacted where necessary.

---

# 50. Auditability

Important security-sensitive actions should be traceable.

Examples:

```text
LOGIN
LOGOUT
FAILED_LOGIN
ROLE_CHANGED
PERMISSION_DENIED
RESOURCE_ACCESS_DENIED
SECURITY_RELEVANT_ERROR
```

The initial project may implement lightweight audit logging rather than a full enterprise audit platform.

---

# 51. Authentication Failure Handling

Repeated failed authentication attempts should be handled without exposing whether a particular account exists.

Example:

Avoid:

```text
User does not exist.
```

Prefer:

```text
Invalid credentials.
```

This reduces account enumeration.

---

# 52. Password Policy

If local authentication is implemented, passwords must meet a reasonable security policy.

Passwords must be:

- hashed;
- never stored in plaintext;
- never logged;
- never returned through APIs.

The password hashing implementation must use a modern, security-reviewed algorithm.

---

# 53. Password Reset

Password reset is not required for the initial portfolio demo unless authentication requirements explicitly introduce it.

If implemented later, reset tokens must be:

- random;
- short-lived;
- single-use;
- stored securely;
- invalidated after use.

---

# 54. Security in Demo Error Scenarios

The demo should simulate security failures without exposing real secrets.

Examples:

```text
401 Unauthorized
403 Forbidden
Validation Error
Expired Session
Invalid Token
Permission Denied
```

These scenarios should be part of the functional demo behavior.

---

# 55. Security Testing

Security tests should cover:

### Authentication

- valid credentials;
- invalid credentials;
- expired token;
- malformed token;
- logout;
- session isolation.

### Authorization

- allowed role;
- denied role;
- resource ownership;
- cross-user access;
- privilege escalation attempts.

### Validation

- malformed payloads;
- missing fields;
- invalid types;
- invalid values;
- unexpected fields.

### Realtime

- unauthorized channel;
- invalid event;
- duplicate event;
- stale event;
- excessive subscription.

---

# 56. Security Acceptance Criteria

The security implementation is considered complete when:

- protected API routes require authentication;
- JWT validation occurs server-side;
- authorization uses RBAC;
- resource ownership is enforced;
- frontend state cannot bypass authorization;
- request payloads are validated;
- database access is isolated behind the backend;
- secrets remain server-side;
- sensitive errors are not exposed;
- CORS is explicitly configured;
- authenticated realtime channels are authorized;
- realtime events are validated;
- session data is cleared on logout;
- demo data contains no real credentials;
- security-sensitive flows have automated tests.

---

# 57. Security Architecture Summary

```text
                         ┌───────────────┐
                         │    Browser    │
                         └───────┬───────┘
                                 │
                         HTTPS / WebSocket
                                 │
                  ┌──────────────▼──────────────┐
                  │       Security Layer        │
                  │                              │
                  │ Authentication              │
                  │ Authorization               │
                  │ Validation                  │
                  │ Rate Limiting               │
                  │ Security Headers             │
                  └──────────────┬──────────────┘
                                 │
                         ┌───────▼───────┐
                         │  Application  │
                         └───────┬───────┘
                                 │
                         ┌───────▼───────┐
                         │    Domain     │
                         └───────┬───────┘
                                 │
                         ┌───────▼───────┐
                         │  Repository   │
                         └───────┬───────┘
                                 │
                         ┌───────▼───────┐
                         │  PostgreSQL   │
                         └───────────────┘
```

---

# 58. Security Philosophy

Security should be implemented as an architectural property rather than as a collection of isolated libraries.

The project should demonstrate that:

> Authentication establishes identity, authorization establishes permission, validation establishes input trust boundaries, and the backend remains the final authority over every protected operation.

The objective is not to build an enterprise security platform.

The objective is to demonstrate **secure engineering decisions that are proportional to the product's actual requirements**.
