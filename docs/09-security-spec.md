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

**Status:** body, query, headers and environment `Implemented` (`apps/api/src/middleware/validate.ts`, `apps/api/src/schemas/`, `apps/api/src/config/env.ts`); route parameters `Planned (B0)` (NFR-021); schemas in `@trading/contracts` `Planned (B0)` (ADR-002 points 1-2); WebSocket messages `Planned (B5)` (ADR-007 points 4 and 15); CSV files `Planned (B4)` (ADR-008 point 10)

All external input is validated before it reaches a service (NFR-021).

| Source | Validation | Status |
| --- | --- | --- |
| Request body | Zod schema per route, `validate(schema, "body")` | `Implemented` |
| Query parameters | Zod schema per route, `validate(schema, "query")` | `Implemented` |
| Route parameters | Ownership-scoped lookup; no schema | `Planned (B0)` |
| JSON syntax and size | `express.json({ limit: "100kb" })` (§27) | `Implemented` |
| Headers | `Authorization` parsed by `authenticate` (§16); `X-Request-ID` checked against an allowlist (§30) | `Implemented` |
| Environment variables | Zod schema at startup; invalid configuration stops the process | `Implemented` |
| WebSocket messages | Zod schemas for `AUTHENTICATE`, `SUBSCRIBE`, `UNSUBSCRIBE` (§33) | `Planned (B5)` |
| CSV import files | Bounded file size and row count; every row validated | `Planned (B4)` |

Code today: request schemas live in `apps/api/src/schemas/`. ADR-002
moves them to `@trading/contracts` in B0, so the API, the demo adapter and
the client share one set.

Code today: `validate` accepts only `query` and `body`; controllers read
route parameters such as `:portfolioId` as plain strings. NFR-021 and
`07-api-spec.md` §45 require path parameters to be parsed too. An unknown
or malformed ID already returns 404, because every lookup is parameterized
and scoped to the owner (§15, §21), so the gap is a validation
inconsistency, not an access risk.

> Open detail (B0): whether a malformed path parameter returns 400
> `VALIDATION_ERROR` from a schema or keeps returning 404 from the lookup.
> The choice is recorded in `07-api-spec.md` with the contracts move.

---

# 19. Validation Strategy

**Status:** boundary and domain validation `Implemented`; application layer `Planned (B0)` (ADR-001 points 1 and 5); validation detail `code` `Planned (B0)` (ADR-002 point 10)

Validation runs in three layers (ADR-001 point 5):

```text
External input
      ↓
Boundary schema (Zod)                         → 400 VALIDATION_ERROR
      ↓
Typed, normalized input (coerced, defaults applied)
      ↓
Application use case (permission, ownership)  → 403 / 404 / 409
      ↓
Domain validators (invariants, rules)         → 400 VALIDATION_ERROR
```

| Layer | Owns | Never owns |
| --- | --- | --- |
| Boundary | Shape, types, ranges, formats, enums | Business rules |
| Application | Permission, ownership, cross-entity state | Zod transport schemas, Express (ADR-001 point 1) |
| Domain | Invariants and business rules (§20) | Transport, persistence |

Transport validation does not replace business-rule validation; both run.
Client validation uses the same schemas for UX only and never replaces
server validation (NFR-021, `Planned (FE)`).

Code today: `validate` stores the parsed output on `req.validated`;
controllers pass it to the services in `apps/api/src/services/`, which call
the domain validators. ADR-001 moves the services into
`@trading/application` in B0 without changing this split.

Code today: each validation `details` entry is `{ field, message }`.
ADR-002 point 10 requires `{ field, code, message }`, where `code` is the
Zod issue code, in B0 (`07-api-spec.md` §7).

---

# 20. Domain Validation

**Status:** `Implemented` (`packages/domain/src/entities/`, `packages/domain/src/calculations/position-recalculation.ts`; mapping in `apps/api/src/middleware/error-handler.ts`)

Business rules live in `@trading/domain`, never only in a controller. A
request can be structurally valid and still break a rule:

```text
SELL quantity = 100, held quantity = 40
→ InsufficientPositionQuantityError
→ 400 VALIDATION_ERROR
```

Portfolios hold no cash balance (ADR-003 point 2), so there is no
"insufficient balance" rule; overselling a position is the equivalent
check.

- Domain errors are named `Invalid*Error` (invariant violated) or
  `Insufficient*Error` (business rule broken by client input). The error
  handler maps both to 400 `VALIDATION_ERROR` with the domain message and
  no `details`.
- Application errors such as `NotFoundError` and `ConflictError` are
  transport-free and mapped by each delivery mechanism; domain validation
  errors keep the mapping above (ADR-001 point 3, `Planned (B0)`).
- Money, prices and quantities are `Decimal` in domain code, and amounts
  in persisted JSON are decimal strings, never JavaScript numbers (ADR-002
  points 3 and 9). The remaining floating-point reads in
  `decision-replay.ts` and `scenario-impact.ts` are replaced in B0.

---

# 21. Injection Protection

**Status:** `Implemented` (Prisma parameterized queries, `packages/database/src/repositories/`); wildcard escaping in asset search `Planned (B7)` (`BACKEND-ROADMAP.md` B7, `PROGRESS.md` §7)

| Vector | Control | Status |
| --- | --- | --- |
| SQL injection | All access through the Prisma client. The only raw query is the input-free tagged template `` $queryRaw`SELECT 1` `` in `apps/api/src/services/health.service.ts` | `Implemented` |
| Command injection | The API spawns no processes or shells | `Implemented` (no surface) |
| NoSQL injection | Not applicable: PostgreSQL only | — |
| Header injection | `X-Request-ID` is echoed only when it matches the allowlist (§30); no other request value is written to a header | `Implemented` |
| Pattern wildcards | Asset `search` passes `%` and `_` unescaped to Prisma `contains` | Known debt, `Planned (B7)` |

Rules:

- Raw SQL is added only when Prisma cannot express a query, and only as
  a tagged-template `$queryRaw` or `$executeRaw`. `$queryRawUnsafe` and
  `$executeRawUnsafe` are never called with interpolated input.
- Imported CSV fields are data: they are validated per row and stored
  through the same repositories (ADR-008 point 10, `Planned (B4)`).

Code today: `prisma-asset-repository.ts` passes the search term to
`contains` unescaped. Prisma still parameterizes the query, so there is
no injection risk; a term containing `%` or `_` matches as a pattern
instead of literal text. `PROGRESS.md` §7 also names transaction filters,
but no other `contains` filter exists in the code.

---

# 22. XSS Protection

**Status:** `Planned (FE)` (NFR-027); API side `Implemented` (JSON-only responses, `helmet` headers, §25)

- User-provided and imported content (portfolio names, notes, decision
  text, CSV fields) renders as text through React's escaping.
- No `dangerouslySetInnerHTML` or `innerHTML` without sanitization by a
  maintained library; 0 unsanitized occurrences in `apps/web` (NFR-027).
- The access token lives in memory, never in browser storage, so an
  injected script cannot read it from storage (§8, NFR-028).
- The API returns JSON only and sends `X-Content-Type-Options: nosniff`
  (§25), so a browser never interprets a response as HTML.
- Encoding happens at render time. The API stores text fields as
  received and does not strip HTML.

Code today: `apps/web` contains only a wireframe; there is no client code
yet. Measurement: a repository search or lint rule over `apps/web`, and a
component test that renders `<script>` in a note as text (NFR-027).

---

# 23. CSRF

**Status:** `Planned (B2)` (ADR-005 point 7; NFR-028); no exposure today (the API sets no cookie)

The CSRF exposure follows the token transport (§8):

| Request | Credential | CSRF control |
| --- | --- | --- |
| Every protected route | `Authorization: Bearer` header from client memory | None needed: a browser never attaches it automatically |
| `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` | Refresh cookie | `SameSite=Strict`, `Path=/api/v1/auth`, required custom request header |

A cross-site form or link cannot set a custom header. A cross-origin
script that tries to set one triggers a CORS preflight, which the API
refuses for origins outside `CORS_ORIGIN` (§24). A request without the
header is rejected, and logout without it revokes nothing (§9).

The header name is an Open detail (B2), §8.

---

# 24. CORS

**Status:** `Implemented` (`apps/api/src/app.ts`, `apps/api/src/config/env.ts`; NFR-025); credentialed CORS for the refresh cookie `Planned (B2)` (ADR-005 Consequences)

- Allowed origins come from `CORS_ORIGIN`, a comma-separated list
  (default `http://localhost:5173`), set per environment (ADR-006
  point 8).
- `Access-Control-Allow-Origin: *` is never used.
- CORS limits which browser origins may call the API. It is not
  authentication; non-browser clients ignore it (§16).
- The public demo calls no backend (ADR-006 point 7), so its origin needs
  no entry.

Code today: `cors({ origin: env.CORS_ORIGIN })` without `credentials`, so
browsers send no cookies cross-origin. B2 enables credentials for the web
origin so the refresh cookie reaches `/api/v1/auth` (Open detail (B2),
§8).

---

# 25. HTTP Security Headers

**Status:** API `Implemented` (`helmet()` defaults and `app.disable("x-powered-by")` in `apps/api/src/app.ts`; NFR-025); header test `Planned (B7)` (`BACKEND-ROADMAP.md` B7); demo host headers `Deferred` (ADR-006 point 2)

`helmet` runs first in the middleware stack, so every response carries
its default headers, including error and 429 responses:

| Protection | Header (helmet 8 default) |
| --- | --- |
| Content Security Policy | `Content-Security-Policy` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Referrer leakage | `Referrer-Policy: no-referrer` |
| Framing | `X-Frame-Options: SAMEORIGIN`, CSP `frame-ancestors 'self'` |
| Transport | `Strict-Transport-Security` |
| Cross-origin isolation | `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` |

- `X-Powered-By` is disabled.
- `Strict-Transport-Security` has no effect over plain HTTP. The local
  stack has no HTTPS; HSTS becomes meaningful only with a public backend,
  which is `Deferred` (ADR-006 point 2, §3).
- Headers of the static demo host are not controlled (NFR-025 accepted
  exception).

Code today: no test asserts the headers. NFR-025 requires one asserting
`X-Content-Type-Options: nosniff` and no `X-Powered-By`.

---

# 26. Rate Limiting

**Status:** `Implemented` (`apps/api/src/middleware/rate-limit.ts`, `apps/api/src/app.ts`); realtime limits `Planned (B5)` (ADR-007 points 11 and 15, §35)

| Limiter | Scope | Limit | Status |
| --- | --- | --- | --- |
| General | Every route except health | 300 requests per 15 minutes per IP | `Implemented` |
| Login | `POST /api/v1/auth/login`, in addition to the general limiter | 5 attempts per 15 minutes per IP | `Implemented` (ADR-005 point 12) |
| Realtime inbound | Per connection | 20 messages per second | `Planned (B5)` |

- Exceeding a limit returns 429 `RATE_LIMITED` in the normal error
  envelope (§29) with standard `RateLimit` headers (draft 7); the legacy
  `X-RateLimit-*` headers are off.
- Health routes are registered before the limiter and never return 429
  (`14-deployment-spec.md` §50-51).
- The store is in memory and per process, which fits the single local API
  (ADR-006 points 1-2). Several instances would each count separately.
- Limiters are skipped under `NODE_ENV=test`; `rate-limit.test.ts`
  verifies the 429 and its body on an isolated limiter.

Coverage of the abuse-prone endpoints:

| Endpoint | Limit |
| --- | --- |
| Login | Dedicated limiter |
| Password-related operations | None exist: no self-registration or reset (§52-53, ADR-005 point 10) |
| Analytics | General limiter |
| `POST /api/v1/auth/refresh` (`Planned (B2)`) | General limiter |
| Simulation control (`Planned (B5)`, `simulation:control`) | General limiter |

> Open detail (B2): whether `POST /api/v1/auth/refresh` also gets a
> dedicated limiter. ADR-005 fixes only the login limit.

---

# 27. Request Size Limits

**Status:** JSON body, pagination and list parameters `Implemented` (`apps/api/src/app.ts`, `apps/api/src/schemas/`, `apps/api/src/middleware/error-handler.ts`); CSV limits `Planned (B4)` (ADR-008 point 10); realtime limits `Planned (B5)` (ADR-007 point 15)

| Input | Limit | Over the limit | Status |
| --- | --- | --- | --- |
| JSON body | 100 kB (`JSON_BODY_LIMIT`) | 413 `VALIDATION_ERROR` `The request body is too large.` | `Implemented` |
| Malformed JSON | — | 400 `VALIDATION_ERROR` `The request body is not valid JSON.` | `Implemented` |
| `pageSize` | 1-100, default 20 (`pagination.schema.ts`) | 400 `VALIDATION_ERROR` | `Implemented` |
| `assetIds` batch | 1-50 ids (`market.schema.ts`, `07-api-spec.md` §19) | 400 `VALIDATION_ERROR` | `Implemented` |
| Text filters | For example `search` ≤ 100 characters (`asset.schema.ts`) | 400 `VALIDATION_ERROR` | `Implemented` |
| Query string | No explicit limit; Node.js caps the request line and headers | 431 from Node.js | Runtime default |
| CSV import | File size and row count, values fixed in B4 | Job rejected | `Planned (B4)` |
| Realtime | 50 subscriptions, 20 inbound messages per second, 1 MB outbound buffer (§35) | `4008` close | `Planned (B5)` |

> Open detail (B5): the maximum inbound WebSocket message size. ADR-007
> point 11 requires bounded memory per connection, but the `ws` library
> accepts messages up to 100 MiB unless `maxPayload` is set.

---

# 28. API Error Security

**Status:** `Implemented` (`apps/api/src/middleware/error-handler.ts`, `apps/api/src/controllers/health.controller.ts`, `apps/api/src/config/env.ts`); structured category logging `Planned (B3)` (ADR-009 points 2 and 6)

Responses never expose stack traces, database or driver errors,
connection details, filesystem paths, environment variables, secrets,
internal service details, the existence of another user's resource
(§15), or which authorization check failed (§17).

| Error | Client sees |
| --- | --- |
| Unexpected exception | 500 `INTERNAL_ERROR` `An unexpected error occurred.` |
| Body-parser error | A fixed message per type (§27) |
| Domain validation error | 400 with the domain message, which describes the input, not internals (§20) |
| `AppError` | Its code and a message written for the client |

- The handler has no environment-specific verbose mode; responses are the
  same in development and production.
- Health endpoints expose no connection strings or raw driver errors.
- Invalid configuration at startup logs only which keys failed, never
  their values.

Code today: an unexpected error is logged server-side as one JSON line
through `console.error`, with `requestId`, `errorName` and `message` and
no stack trace. ADR-009 replaces this in B3 with `pino`, levels by error
category, and the stack trace at `error` level (points 2 and 6), with the
redaction list of §49 (point 4).

---

# 29. Error Structure

**Status:** `Implemented` (`apps/api/src/middleware/error-handler.ts`, `apps/api/src/middleware/rate-limit.ts`; ADR-002 point 2); envelope schema in `@trading/contracts` and detail `code` `Planned (B0)` (ADR-002 points 2 and 10)

`07-api-spec.md` §5-7 owns the error contract. Every error, including 404
for unknown routes and 429, uses one envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource could not be found.",
    "requestId": "3f0c2a9e-...",
    "details": []
  }
}
```

- `code` comes from `AppErrorCode` (`07-api-spec.md` §6). The codes are
  stable and coarse, so they reveal no internal state.
- `message` is English and meant for logs; clients map `code` to a
  localized message (ADR-010 point 8).
- `details` describes only the client's own invalid input (§19).
- Internal logs may carry more diagnostic information (§28).

---

# 30. Request IDs

**Status:** header and error envelope `Implemented` (`apps/api/src/middleware/request-id.ts`); log propagation `Planned (B3)` (ADR-009 point 5); realtime `connectionId` `Planned (B5)` (ADR-009 point 5)

- Every response carries `X-Request-ID`. The middleware runs before the
  rate limiter and the routes, so 429 and error responses carry it too.
- A client-supplied value matching `^[a-zA-Z0-9-]{1,64}$` is reused;
  anything else is replaced by a generated UUID. The allowlist keeps the
  value safe to log and to echo in a header (§21).
- A request ID is a correlation handle, not a secret, and grants nothing.
- The same value is the `requestId` of every error envelope (§29).

Code today: the ID reaches the error envelope and the unexpected-error
log line only. ADR-009 point 5 propagates it to every log line of a
request through `AsyncLocalStorage` in B3; jobs carry `jobId` and realtime
connections `connectionId`. The correlation strategy is
`13-observability-spec.md` §9.

---

# 31. Realtime Security

**Status:** `Planned (B5)` (ADR-007 points 2-3 and 15, ADR-005 points 3 and 12; FR-086, NFR-020, NFR-026)

This section is the security view of the realtime protocol, which
`08-realtime-spec.md` owns (§9, §10, §55).

```text
WebSocket connection (no token in the URL)
   ↓
AUTHENTICATE { accessToken } within 5 s       → otherwise close 4001
   ↓
Actor { userId, role } loaded from the database
   ↓
SUBSCRIBE { channel } → application-layer check → ACK | ERROR (§32)
   ↓
Token expires without re-authentication       → close 4002
```

- The token is never put in the URL, where it would reach logs, browser
  history and proxies.
- The socket is bound to the expiry of its token. Re-authenticating after
  a refresh extends the bound and reloads role and ownership, dropping any
  subscription the actor may no longer hold (`08-realtime-spec.md` §9).
- Re-authenticating with another user's token is rejected and the socket
  is closed (`08-realtime-spec.md` §9, ADR-007 Deferred detail).
- Tokens are never logged (`08-realtime-spec.md` §58, ADR-009 point 4).
- The local stack uses `ws://`; WSS is `Deferred` with the public backend
  (ADR-006 point 2, §3).
- The demo has no token handshake; its in-process adapter runs the same
  application-layer checks for behavior parity, not security
  (`08-realtime-spec.md` §56).

The socket authenticates with a message, not a cookie, so a page on
another origin that opens a socket gains no ambient credential.

> Open detail (B5): whether the server also checks the `Origin` header of
> the upgrade request against `CORS_ORIGIN`.

---

# 32. Channel Authorization

**Status:** `Planned (B5)` (ADR-007 point 3, ADR-008 point 11, ADR-005 points 3 and 12; FR-086, NFR-020)

Knowing a channel name never grants access. Every `SUBSCRIBE` is
authorized by an application-layer use case, by permission (§13) and
ownership (§14), so the API and the demo run the same check
(`08-realtime-spec.md` §10):

| Channel | Authorization |
| --- | --- |
| `market:{assetId}` | Any authenticated actor (`market:read`) |
| `portfolio:{portfolioId}` | `portfolio:read` and ownership of the portfolio |
| `notifications` | The authenticated user only; no ID in the name (`notification:read`) |
| `jobs:{jobId}` | Ownership of the job |

```text
User A → SUBSCRIBE portfolio:{portfolio of User B} → ERROR, no events
```

- A refused subscription to another user's channel is indistinguishable
  from an unknown channel, so existence is not revealed (ADR-005
  point 12, `08-realtime-spec.md` §55).
- `user:{userId}` and `notifications:{userId}` are removed; no channel
  name carries a user ID.
- `ALERT_TRIGGERED` is delivered on `notifications`, because alerts are
  user-scoped (ADR-007 point 15).
- Authorization is re-evaluated on every re-authentication (§31).

---

# 33. Realtime Event Validation

**Status:** server `Planned (B5)`; client `Planned (FE)` (ADR-007 points 4 and 15, ADR-002 points 1 and 6)

Clients never publish events. The only client messages are
`AUTHENTICATE`, `SUBSCRIBE` and `UNSUBSCRIBE`, so the server never trusts
a client-supplied event `type`, `payload` or metadata.

| Direction | Validation | On failure |
| --- | --- | --- |
| Client → server | Every message parsed with its `@trading/contracts` Zod schema; unknown `type` or malformed `channel` refused | `ERROR` reply with a `code` |
| Server → client | Envelope `{ id, type, channel, sequence, timestamp, payload }` built from the contract schemas; only catalog types (`08-realtime-spec.md` §14-15) | Covered by contract tests (ADR-002 point 6) |
| Client receives | Envelope, `type`, `payload` and channel checked (`08-realtime-spec.md` §23) | Event dropped and logged; `sequence` not advanced |

Every inbound message, valid or not, counts toward the inbound rate
limit (§35). The `ERROR` code set is an Open detail (B5) of
`08-realtime-spec.md` §9.

---

# 34. Realtime Event Integrity

**Status:** server `sequence` `Planned (B5)`; client checks `Planned (FE)` (ADR-007 points 4-5; NFR-018)

| Need | Mechanism | Reference |
| --- | --- | --- |
| Ordering | `sequence` monotonic per channel | `08-realtime-spec.md` §24 |
| Deduplication and replay detection | Apply only `incomingSequence > lastProcessedSequence`; anything else is discarded | `08-realtime-spec.md` §24, §47 |
| Gap detection | `incomingSequence > lastProcessedSequence + 1` triggers an HTTP resynchronization | `08-realtime-spec.md` §25-26 |
| Consistency | HTTP stays the source of truth after gaps and reconnects | `08-realtime-spec.md` §26 |
| Identification | Envelope `id` for logs and diagnostics | `08-realtime-spec.md` §47 |

- There is no server replay buffer in version 1, so a missed event is
  never replayed (ADR-007 point 5).
- Events carry no signature. Integrity rests on the authenticated socket
  and the server being the only publisher (§33).
- A per-process epoch lets clients reset their baseline after a server
  restart (`08-realtime-spec.md` §14, ADR-007 Deferred detail, B5).

The scope and format of the envelope `id` are an Open detail (B5) of
`08-realtime-spec.md` §47.

---

# 35. Realtime Rate Protection

**Status:** `Planned (B5)` (ADR-007 points 2, 11 and 15)

Server limits per connection (`08-realtime-spec.md` §7, §48):

| Abuse | Limit | Enforcement |
| --- | --- | --- |
| Unauthenticated sockets | 5 s to send `AUTHENTICATE` | Close `4001` |
| Unlimited subscriptions | 50 per connection | `ERROR` reply or close `4008` (Open detail (B5), `08-realtime-spec.md` §7) |
| Uncontrolled messages | 20 inbound messages per second | Close `4008` |
| Slow consumers | 1 MB outbound buffer | Drop or close `4008` (Open detail (B5), `08-realtime-spec.md` §48) |
| Dead sockets | Ping every 30 s; close after 2 missed pongs (about 60 s) | Close code is an Open detail (B5), `08-realtime-spec.md` §7 |
| Unnecessary channels | Only catalog channels are authorized (§32); the client unsubscribes when no view needs a channel | `08-realtime-spec.md` §52 |

Exceeding a limit closes the socket with `4008` (`08-realtime-spec.md`
§7, §9).

> Pending decision: a limit on concurrent connections per user or per
> IP. ADR-007 fixes limits per connection only; unauthenticated sockets
> are bounded by the 5-second timeout, authenticated ones by nothing.

---

# 36. Database Security

**Status:** `Implemented` (`packages/database/src/client.ts`, `packages/database/src/repositories/`; ADR-001); use cases behind the application layer `Planned (B0)` (ADR-001 point 1); public demo without a database `Planned (FE)` (ADR-006 points 1-2 and 7)

Only backend infrastructure reaches PostgreSQL. The browser never
connects to it, and the public demo has no database at all (ADR-006
point 7).

```text
Browser ──X──> PostgreSQL

Browser
  ↓
API (Express)
  ↓
Application use case        ← Planned (B0)
  ↓
Repository (@trading/database)
  ↓
Prisma client
  ↓
PostgreSQL
```

- `packages/database/src/client.ts` is the only module that imports the
  generated Prisma client; every repository uses its shared `prisma`
  instance.
- Services in `apps/api/src/services/` import repository classes from
  `@trading/database`, never the Prisma client. The only direct client
  call is the input-free health query (§21).
- All queries are parameterized through Prisma (§21).

Code today: the Compose file publishes PostgreSQL on host port
`${DATABASE_PORT:-5432}` without a bind address, so it listens on every
host interface, not only `localhost`.

> Open detail (B7): whether the Compose port binds to `127.0.0.1` only.
> ADR-006 point 4 keeps PostgreSQL in the default profile; the binding is a
> hardening detail of that profile.

---

# 37. Database Credentials

**Status:** `Implemented` (`.gitignore`, `packages/database/prisma/schema.prisma`, `apps/api/src/controllers/health.controller.ts`; NFR-022, NFR-023); demo build `Planned (FE)` (ADR-006 point 7)

Database credentials exist only on the server, in `DATABASE_URL`, which
Prisma reads from the environment (`env("DATABASE_URL")`).

| Never | Control | Status |
| --- | --- | --- |
| Committed | `.env`, `.env.local` and `.env.*.local` are ignored; only `*.example` files are tracked (§43) | `Implemented` |
| Returned by the API | Health reports `database: "ok"` or `unavailable`, never a connection string or driver error (§28) | `Implemented` |
| Embedded in the frontend build | The demo build has no backend and no secrets (ADR-006 point 7) | `Planned (FE)` |
| Included in mock or seed data | Seed data holds no infrastructure credentials (§42) | `Implemented` |
| Written to logs | The health log line carries `errorName` only; redaction list (§49) | `Implemented`; redaction `Planned (B3)` |

Code today: `docker-compose.yml` carries development defaults for
`DATABASE_USER` and `DATABASE_PASSWORD` (`trading_dev_password`), which
any value in `.env` overrides. They protect a local-only database
(ADR-006 point 1) and are not secrets of a deployed system.

> Open detail (B7): whether the `full` Compose profile (ADR-006 point 4)
> keeps these committed defaults or requires the values from `.env`.

---

# 38. Least Privilege

**Status:** environment separation `Implemented` (`packages/database/package.json`, `PROGRESS.md` §2.3); non-root API container `Planned (B7)` (ADR-006 point 4); database role privileges Pending decision

| Concern | Today | Target |
| --- | --- | --- |
| Development vs test data | Separate databases: `.env` for development, `.env.test.local` for tests (`db:test:migrate`, `test` scripts) | `Implemented` |
| Development vs local production | One local stack (ADR-006 points 1 and 8) | `production` values set in the `full` profile, `Planned (B7)` |
| API process | Runs as the developer's user | Non-root user in the multi-stage Dockerfile (ADR-006 point 4), `Planned (B7)` |
| Database role | The Compose `POSTGRES_USER`, which the PostgreSQL image creates as a superuser; the test database is owned by the same role | See the pending decision below |

Code today: the API, the migrations and the tests connect with the same
role. `prisma migrate dev` needs to create a shadow database, and startup
applies `prisma migrate deploy` (ADR-006 point 5), so the role that runs
migrations needs DDL rights.

> Pending decision: whether the API connects at runtime with a separate
> role limited to data access, keeping DDL rights for the migration role
> only. No ADR addresses database role privileges; ADR-006 keeps the
> database local only.

---

# 39. Sensitive Data

**Status:** `Implemented` (`packages/database/prisma/schema.prisma`, `apps/api/src/services/auth.service.ts`; NFR-022); sessions `Planned (B2)` (ADR-005 point 5); job input and idempotency records `Planned (B4)` (ADR-008 points 4 and 8)

The system stores as little sensitive data as its features need. It holds
no real financial account data (§40).

| Data | Storage | Exposure rule | Status |
| --- | --- | --- | --- |
| Password | `Credential.passwordHash`, a `bcryptjs` hash in its own table (`05-data-model.md` §5.2) | Never returned or logged (§52) | `Implemented` |
| Email, display name | `User` (`05-data-model.md` §5) | Returned only to the user themself (`GET /auth/me`); logs carry `userId` only (ADR-009 point 3) | `Implemented`; logs `Planned (B3)` |
| Refresh token | Sessions table, hash only (`05-data-model.md` §5.3) | Cookie only (§8) | `Planned (B2)` |
| Successor refresh token | Encrypted at rest for the grace window only, then cleared (ADR-005 Deferred detail) | Never logged | `Planned (B2)` |
| CSV import input | The `jobs` row, bounded in size (`05-data-model.md` §52) | Owner only (ADR-008 point 9); never logged (ADR-009 Deferred detail) | `Planned (B4)` |
| Idempotency records | Request hash and stored response per user, 24 hours (ADR-008 point 8) | Replayed only to the same user | `Planned (B4)` |
| Portfolio and transaction data | Domain tables | Owner only (§14, §15) | `Implemented` |

The demo uses synthetic data only (§42).

> Open detail (B2): the encryption key and algorithm for the successor
> refresh token, and how the key is provided (§43). ADR-005 requires
> encryption at rest without fixing either.

---

# 40. Financial Data Boundary

**Status:** `Implemented` (no surface: `packages/database/prisma/schema.prisma` has no credential, account or payment field besides `Credential.passwordHash`; ADR-003, ADR-006 point 2)

Trading Analytics Platform is a portfolio engineering project. It never
stores, requests or processes:

- broker or exchange API keys;
- bank, brokerage or payment credentials;
- real trading account information.

- Portfolios are sets of holdings with no cash balance and no link to any
  external account (ADR-003 point 2). Transactions are recorded by the
  user, not executed.
- Market data comes from the internal simulator (ADR-007), not a real
  market API, so the system needs no provider key.
- CSV import reads a file the user uploads; it never connects to a broker
  (ADR-008 point 1).

Adding any external financial integration requires a new ADR.

---

# 41. Demo Mode Security

**Status:** `Planned (FE)` (ADR-005 point 11, ADR-006 point 7, ADR-001); demo data layers, reset and failure scripting `Deferred` (ADR-010 point 6)

The public demo is a static build of `apps/web` that runs the application
in process with demo adapters (ADR-001, ADR-006 point 1).

- Identity: a controlled demo identity with a role selector (Viewer,
  Trader, Admin). It never asks for a real password, financial
  credential, API key or brokerage token (ADR-005 point 11,
  `12-demo-mode-spec.md` §55).
- Same rules: demo use cases run the same permission and ownership checks
  as the API (§2 principle 13, `12-demo-mode-spec.md` §57). Because the
  demo has no server, these checks give behavior parity, not security
  (NFR-026).
- Separation: no calls to any backend, no secrets in the build, and
  namespaced browser storage (ADR-006 point 7). The demo never falls back
  to real infrastructure (`12-demo-mode-spec.md` §59).

Code today: `apps/web` contains only a wireframe.

ADR-010 point 6 leaves the demo data layers, reset, simulated latency and
scripted failures to a frontend-stage ADR. `12-demo-mode-spec.md` is not
reconciled yet; where it conflicts with an ADR, the ADR wins.

---

# 42. Mock Data

**Status:** seed data `Implemented` (`packages/database/src/seed/data/`); demo datasets `Deferred` (ADR-010 point 6)

Seed and demo data contain no real personal information. Users,
portfolios, transactions, assets, notifications and market events are
synthetic.

- The seed creates one demo user (`demo@trading-analytics.dev`) with
  synthetic portfolios and history (`seed/data/user.ts`,
  `seed-users-and-portfolios.ts`).
- Identifiers are generated (`cuid()`), not copied from real systems.
- Asset symbols and names are fictional or public market symbols with
  simulated prices (ADR-007); they are not translated (ADR-010 point 8).

Code today: `seed/data/credential.ts` documents the demo user's plaintext
password on purpose, next to its pre-computed `bcryptjs` hash. The
password is synthetic and protects only local seed data; the seed never
runs automatically (ADR-006 point 5).

---

# 43. Secrets Management

**Status:** `Implemented` (`apps/api/src/config/env.ts`, `.gitignore`; NFR-023); `DATABASE_URL` startup validation `Planned (B7)`; demo build `Planned (FE)` (ADR-006 point 7)

Secrets come from environment configuration only.

| Variable | Secret | Validation | Status |
| --- | --- | --- | --- |
| `JWT_SECRET` | Yes | At least 32 characters; otherwise the API exits with code 1 | `Implemented` |
| `DATABASE_URL` | Yes | Read by Prisma; not part of the API schema | Startup check `Planned (B7)` |
| `PORT`, `JWT_EXPIRES_IN_SECONDS`, `CORS_ORIGIN`, `NODE_ENV` | No | Zod schema with defaults | `Implemented` |
| `APP_MODE` / `VITE_APP_MODE` | No | `real` or `demo` (ADR-006 point 8) | `Planned (FE)` |

- `.env`, `.env.local` and `.env.*.local` are ignored. Only
  `.env.example` and `.env.test.example` are tracked, and they hold
  placeholders only.
- Invalid configuration logs which keys failed, never their values
  (`env.ts`, §28).
- Only `VITE_`-prefixed variables reach the web build, and none of them
  is a secret (ADR-006 point 7).

Code today: `env.ts` does not validate `DATABASE_URL`. A missing or
malformed value surfaces at the first query, through readiness, instead
of at startup as NFR-023 requires for required secrets.

> Open detail (B7): adding `DATABASE_URL` to the startup schema, with the
> canonical variable list of ADR-006 point 8.

---

# 44. Dependency Security

**Status:** lockfile and build-script allowlist `Implemented` (`pnpm-lock.yaml`, `pnpm-workspace.yaml`); frozen-lockfile install in CI `Planned (B0)` (ADR-006 point 10); audit `Planned (B7)` (NFR-024)

| Control | Mechanism | Status |
| --- | --- | --- |
| Reproducible installs | `pnpm-lock.yaml` committed; `packageManager` pinned in `package.json` | `Implemented` |
| Install scripts | `allowBuilds` in `pnpm-workspace.yaml` lists the only packages allowed to run build scripts (Prisma, esbuild) | `Implemented` |
| Clean-checkout install | One GitHub Actions workflow installs with the lockfile (ADR-006 point 10) | `Planned (B0)` |
| Vulnerability check | `pnpm audit --prod --audit-level=high` reports 0 high or critical advisories, or each is recorded with a reason (NFR-024) | `Planned (B7)` |

Dependencies are actively maintained, come from the npm registry, are
reviewed before they are added (§45), and are kept reasonably current.
Security updates take priority over feature work.

Accepted exception (NFR-024): the minimal CI does not run the audit and no
automated update bot is configured; the audit is a manual step of the
`14-deployment-spec.md` §78 checklist.

Code today: `.github/` holds only `PULL_REQUEST_TEMPLATE.md`; there is no
workflow yet.

---

# 45. Dependency Policy

**Status:** `Reference`; explicit tests per mechanism as listed in §55

A dependency is never added as a shortcut around understanding a security
boundary. Security-critical behavior stays understandable and testable:

| Mechanism | Library | Behavior owned by the project | Tests |
| --- | --- | --- | --- |
| JWT verification | `jsonwebtoken` | Payload shape, secret length, rejection rules (§6, §16) | `Implemented` (`auth.routes.test.ts`); expiry and algorithm `Planned (B2)` |
| Password hashing | `bcryptjs` | Generic failure message (§51) | `Implemented` (`auth.routes.test.ts`) |
| Authorization rules | None | Permission matrix in the application layer (§13) | `Planned (B2)` |
| Resource ownership | None | Owner-scoped lookups (§14) | `Implemented` (cross-user route tests) |
| Input validation | `zod` | Schemas per route and in `@trading/contracts` (§18) | `Implemented` (`validate.test.ts`, route tests) |
| Rate limiting | `express-rate-limit` | Limits and 429 envelope (§26) | `Implemented` (`rate-limit.test.ts`) |
| Log redaction | `pino` | Fixed redaction list (§49) | `Planned (B3)` (ADR-009 point 13) |

---

# 46. Frontend Security Boundary

**Status:** server enforcement `Implemented` (ownership, `apps/api/src/services/`); application-layer enforcement `Planned (B0)`/`Planned (B2)` (ADR-001, ADR-005 point 3; NFR-026); client `Planned (FE)`

The frontend is untrusted. The API never trusts these values from client
state or request data:

| Value | Authoritative source |
| --- | --- |
| Role and permissions | The user record read on `GET /auth/me` and on refresh (ADR-005 point 9); the token's `role` claim is a hint (§6) |
| Portfolio ownership | The owning portfolio or user in the database (§14) |
| Current prices and market values | `MarketPrice` and server calculations (`05-data-model.md` §31) |
| Holdings and transaction acceptance | Domain validation against stored positions (§20, ADR-003 point 6) |
| Administrative status | `simulation:control` in the permission matrix (§13) |

A transaction's own `price` is user input describing a recorded trade; it
is validated (§18-§20) but never used as the current market price.

---

# 47. Client-Side Role Checks

**Status:** `Planned (FE)` (ADR-005 points 2 and 11; NFR-026)

The client may hide or disable actions for UX. It checks permissions, as
the server does, never role names (ADR-005 point 2):

```text
if actor has simulation:control
    show simulation controls
```

The API checks the same permission independently. Editing client state,
the in-memory token or the demo role selector grants no extra privilege on
the server: the server reads the role from the database (§46). In the
demo, which has no server, the same use-case checks give parity, not
security (NFR-026).

Measurement: the NFR-020 tests call the API directly, bypassing the UI
(NFR-026).

---

# 48. Sensitive Information in URLs

**Status:** API `Implemented` (`apps/api/src/routes/auth.routes.ts`, `apps/api/src/middleware/authenticate.ts`); WebSocket `Planned (B5)` (ADR-007 point 2); client routes `Planned (FE)` (NFR-019)

Credentials, tokens and secrets never appear in a URL, so they never reach
browser history, server logs or `Referer` headers (NFR-019).

| Credential | Transport | Status |
| --- | --- | --- |
| Email and password | `POST /api/v1/auth/login` JSON body | `Implemented` |
| Access token | `Authorization: Bearer` header | `Implemented` |
| Refresh token | `HttpOnly` cookie (§8) | `Planned (B2)` |
| WebSocket token | `AUTHENTICATE` message, never the connection URL (ADR-007 point 2) | `Planned (B5)` |

Path and query parameters carry only resource IDs, filters and pagination.
IDs grant nothing without ownership (§15). Client routes follow the same
rule (`Planned (FE)`).

---

# 49. Logging Security

**Status:** today's log lines `Implemented` without secrets (`apps/api/src/middleware/error-handler.ts`, `apps/api/src/controllers/health.controller.ts`, `apps/api/src/config/env.ts`); structured logging and redaction `Planned (B3)` (ADR-009 points 2-4 and 13; NFR-019, NFR-022)

These are never logged (ADR-009 point 4, Deferred detail):

- passwords;
- the `Authorization` header, access tokens and refresh tokens;
- request cookies and the response `Set-Cookie` header;
- the access token inside the WebSocket `AUTHENTICATE` message;
- CSV import input;
- `JWT_SECRET`, `DATABASE_URL` and other secrets.

Log lines identify the user by `userId` only, never by email or display
name (ADR-009 point 3). Redaction is a fixed path list in the `pino`
adapter and is enforced by unit tests (ADR-009 points 4 and 13).

Code today: logging is `console.*`. The unexpected-error line logs
`requestId`, `errorName` and the error `message`; the health line logs
`errorName` only; `env.ts` logs failing keys only. No line writes request
headers or bodies, but the error `message` is not filtered.

---

# 50. Auditability

**Status:** `Planned (B3)` (ADR-009 points 3, 9 and 13); refresh reuse event `Planned (B2)` (ADR-005 point 5)

Security-relevant actions are traceable through structured security
events in the operational log (ADR-009 point 9). Version 1 has no separate
audit store; operational logs are not permanent audit storage
(`13-observability-spec.md` §45).

| Event | When | Block |
| --- | --- | --- |
| `auth.login.succeeded` | Valid credentials | B3 |
| `auth.login.failed` | Any credential failure, with the same fields whatever the cause (§51) | B3 |
| `auth.refresh.reuse_detected` | An already-rotated refresh token is presented and its family is revoked (§7) | B2 / B3 |
| `authz.denied` | A permission check fails, including a refused realtime subscription (§17) | B2 / B5 |

Each event carries `timestamp`, `event`, `requestId` and `userId` when
known, and none of the fields of §49.

Not covered in version 1: role changes have no endpoint (roles come from
the seed, ADR-005 point 10), so there is no role-change event.

> Open detail (B3): whether logout emits an event. ADR-009 point 9 does
> not list one; `13-observability-spec.md` names `auth.logout`.

> Open detail (B3): whether a cross-user request answered with 404 (§15)
> emits `authz.denied`. ADR-009 point 9 names the event without listing
> its triggers.

---

# 51. Authentication Failure Handling

**Status:** `Implemented` (`apps/api/src/services/auth.service.ts`, `apps/api/src/middleware/rate-limit.ts`; ADR-005 point 12; FR-001, NFR-019); failure event `Planned (B3)` (ADR-009 point 9)

Failed logins never reveal whether an account exists:

| Case | Response |
| --- | --- |
| Unknown email | 401 `UNAUTHORIZED` `Invalid credentials.` |
| User without a credential | 401 `UNAUTHORIZED` `Invalid credentials.` |
| Wrong password | 401 `UNAUTHORIZED` `Invalid credentials.` |
| More than 5 attempts in 15 minutes from one IP | 429 `RATE_LIMITED` (§26) |

- There is no account lockout. Repeated failures are bounded per IP by the
  login limiter (ADR-005 point 12), so a third party cannot lock a user
  out.
- Each failure is logged as `auth.login.failed` from B3 (§50).
- A malformed body (for example an invalid email) returns 400
  `VALIDATION_ERROR` before any lookup, so it reveals nothing about
  accounts.

Code today: an unknown email returns without running a `bcrypt`
comparison, so it responds measurably faster than a wrong password for an
existing account. The message is identical; the timing is not.

> Pending decision: whether login equalizes timing, for example by
> comparing against a fixed dummy hash when the user or credential is
> missing. ADR-005 and NFR-019 require the generic message only.

---

# 52. Password Policy

**Status:** `Implemented` (`apps/api/src/services/auth.service.ts`, `packages/database/src/seed/data/credential.ts`; ADR-005 points 10 and 12; NFR-019)

| Rule | Status |
| --- | --- |
| Hashed with `bcryptjs`, cost 10 or higher (NFR-019) | `Implemented` (the seed hash uses cost 10) |
| Never stored in plaintext | `Implemented` (`Credential.passwordHash` only) |
| Never returned by the API | `Implemented` (login and `me` return the user without credential fields) |
| Never logged | `Implemented` (no log line writes the body); redaction test `Planned (B3)` (§49) |

Version 1 sets no password through the API: there is no registration
(ADR-005 point 10), password change or reset (§53). The only password is
the seeded demo user's (§42). The API compares passwords and never hashes
one; the login schema requires a non-empty string only.

A strength policy (length, breached-password check) applies only when an
endpoint that sets passwords is introduced, which requires a new decision.

---

# 53. Password Reset

**Status:** `Deferred` (ADR-005 point 10)

Version 1 has no password reset: users come from the seed and there is no
self-service account management. No reset endpoint, token or email flow
exists or is planned in B0-B7.

If a later ADR introduces reset, its tokens are:

- random and unguessable;
- short-lived;
- single-use and invalidated after use;
- stored as hashes, like refresh tokens (§39);
- requested through a response that does not reveal whether the account
  exists (§51).

---

# 54. Security in Demo Error Scenarios

**Status:** `Deferred` (ADR-010 point 6); role-based denials `Planned (FE)` (ADR-005 point 11)

The demo shows security failures without exposing real secrets:

| Scenario | Source in the demo | Status |
| --- | --- | --- |
| 403 `FORBIDDEN` for an action the selected role lacks | The real permission check with the demo role (§41) | `Planned (FE)` |
| 401 `UNAUTHORIZED`, expired session, invalid token | Scripted failures | `Deferred` |
| 400 `VALIDATION_ERROR` | The real boundary and domain validation (§19) | `Planned (FE)` |

ADR-010 point 6 leaves scripted failures to a frontend-stage ADR. Any
injected error uses the same error envelope and codes as the API (§29) and
contains no real token, secret or stack trace.

---

# 55. Security Testing

**Status:** `Implemented` where marked, with the files named; other groups `Planned` in the listed block

Each test calls the API (or the use case, from B0) directly, never through
the UI, so a hidden control is never the protection under test (NFR-026).

### Authentication

| Case | Status |
| --- | --- |
| Valid credentials return a usable token | `Implemented` (`auth.routes.test.ts`) |
| Wrong password and unknown email return the same 401 | `Implemented` (`auth.routes.test.ts`) |
| Missing and malformed token return 401 | `Implemented` (`auth.routes.test.ts`) |
| Login rate limit returns 429 with the error envelope | `Implemented` (`rate-limit.test.ts`) |
| Expired token, wrong algorithm, unknown role return 401 | `Planned (B2)` |
| Startup fails with a missing or short `JWT_SECRET` | `Planned (B7)` (NFR-019, NFR-023) |
| Refresh rotation, reuse detection, parallel refresh, lost response | `Planned (B2)` (ADR-005 Deferred detail) |
| Logout revokes the family; refresh and logout without the custom header are rejected | `Planned (B2)` (NFR-028) |
| Cookie attributes (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path`) | `Planned (B2)` (NFR-028) |
| Session isolation after logout and role switch | `Planned (FE)` (§10) |

### Authorization

| Case | Status |
| --- | --- |
| Cross-user access returns 404, never 403, and changes nothing | `Implemented` (`portfolios`, `alerts`, `decisions`, `notifications`, `preferences` route tests) |
| Allowed role, denied role (403), escalation attempts | `Planned (B2)` (NFR-020) |
| Every matrix row of §13 | `Planned (B2)` |

### Validation

| Case | Status |
| --- | --- |
| Malformed payloads, missing fields, invalid types and values return 400 | `Implemented` (`validate.test.ts`, route tests) |
| Oversized JSON body returns 413 | `Implemented` (`validate.test.ts`) |
| Malformed JSON body returns 400 | `Implemented` (`validate.test.ts`) |
| Malformed path parameters | `Planned (B0)` (§18) |
| Unexpected fields | `Planned (B0)` (see the Open detail below) |
| CSV size, row count and per-row validation | `Planned (B4)` (ADR-008 point 10) |

### Realtime

| Case | Status |
| --- | --- |
| No `AUTHENTICATE` within 5 s closes `4001`; expired token closes `4002` | `Planned (B5)` |
| Unauthorized channel is refused and logged as `authz.denied` | `Planned (B5)` |
| Invalid, duplicate and stale events | `Planned (B5)`; client checks `Planned (FE)` (§33, §34) |
| Subscription and inbound-rate limits close `4008` | `Planned (B5)` (§35) |

### Transport, data and logging

| Case | Status |
| --- | --- |
| `helmet` headers present, no `X-Powered-By` | `Planned (B7)` (§25) |
| Unexpected errors return the generic 500 without internals | `Planned (B3)` (error classification tests) |
| Readiness with the database down exposes no driver error | `Planned (B7)` (security checklist) |
| Redaction of every field in §49 | `Planned (B3)` (ADR-009 point 13) |
| `git ls-files` lists no `.env` file except examples | `Planned (B7)` (NFR-023) |
| Dependency audit | `Planned (B7)` (NFR-024) |
| No unsanitized HTML in `apps/web`; no token in browser storage | `Planned (FE)` (NFR-027, NFR-028) |

> Open detail (B0): request schemas use Zod's default object parsing,
> which strips unknown fields instead of rejecting them. Whether the
> contracts in `@trading/contracts` reject unknown fields is fixed with
> the B0 move (ADR-002); the test asserts whichever behavior is chosen.

---

# 56. Security Acceptance Criteria

**Status:** `Reference`; each criterion is measured by §55

Security is complete for version 1 when:

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Every protected route requires a valid Bearer token | `Implemented` |
| 2 | JWT validation runs server-side with a pinned algorithm and rejects unknown roles | `Implemented`; pinning and roles `Planned (B2)` |
| 3 | Refresh tokens rotate, reuse revokes the family, and logout revokes the session | `Planned (B2)` |
| 4 | Every use case checks permission (§13) and ownership in the application layer | Ownership `Implemented`; permissions `Planned (B0)`/`Planned (B2)` |
| 5 | Another user's resource returns 404, never 403 | `Implemented` |
| 6 | Client state cannot bypass authorization | `Implemented` (server checks); client `Planned (FE)` |
| 7 | Every body, query and path parameter is validated | Body and query `Implemented`; path `Planned (B0)` |
| 8 | Database access stays behind the backend repositories | `Implemented` |
| 9 | Secrets stay server-side, are validated at startup and are never tracked | `Implemented`; `DATABASE_URL` check `Planned (B7)` |
| 10 | Errors expose no internals and do not reveal another user's resources | `Implemented` |
| 11 | CORS allows only `CORS_ORIGIN`, with credentials for the refresh cookie | `Implemented`; credentials `Planned (B2)` |
| 12 | Realtime sockets authenticate by message and channels are authorized | `Planned (B5)` |
| 13 | Realtime events are validated and ordered by `sequence` | `Planned (B5)`; client `Planned (FE)` |
| 14 | No credential, token or secret is logged, enforced by tests | `Planned (B3)` |
| 15 | Security events of §50 are emitted | `Planned (B3)` |
| 16 | Session data is cleared on logout and role switch | `Planned (FE)` |
| 17 | Demo data is synthetic and the demo build contains no secrets | Seed `Implemented`; build `Planned (FE)` |
| 18 | The dependency audit shows no unrecorded high or critical advisory | `Planned (B7)` |
| 19 | Every row of §55 has an automated test | Partial; see §55 |

---

# 57. Security Architecture Summary

**Status:** `Reference` (ADR-001, ADR-005, ADR-006, ADR-007)

```text
                    ┌──────────────────────────────┐
                    │  Browser (untrusted, §46)    │
                    │  access token in memory      │
                    └──────────────┬───────────────┘
                                   │
          HTTP on localhost, no HTTPS (ADR-006)    WebSocket (Planned B5)
          Bearer header; refresh cookie (B2)       AUTHENTICATE message
                                   │
                    ┌──────────────▼───────────────┐
                    │  API boundary (Express)      │
                    │  helmet, CORS, request ID,   │
                    │  rate limits, authenticate   │
                    │  → Actor, Zod validation     │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Application (Planned B0)    │
                    │  permission + ownership      │
                    │  same checks in the demo     │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Domain: invariants, rules   │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Repositories → Prisma       │
                    │  parameterized queries       │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  PostgreSQL (local only)     │
                    └──────────────────────────────┘
```

- Authentication happens at the boundary; authorization happens in the
  application layer, never in middleware (ADR-005 point 3, ADR-001).
- The same application layer runs in the public demo with demo adapters
  and no backend (ADR-001, ADR-006 point 7).
- The backend runs locally only; a public backend behind HTTPS and WSS is
  `Deferred` until a new ADR (ADR-006 point 2).

---

# 58. Security Philosophy

**Status:** `Reference`

Security is an architectural property, not a collection of isolated
libraries.

> Authentication establishes identity, authorization establishes
> permission, validation establishes input trust boundaries, and the
> backend remains the final authority over every protected operation.

The objective is not an enterprise security platform. It is secure
engineering decisions proportional to the product's actual requirements:
a local backend, a static demo, synthetic data and no real financial
integration (ADR-003, ADR-006).
