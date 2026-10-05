# SDD 07 — API Specification

**Project:** Trading Analytics Platform  
**Status:** §1-§9 reconciled with the code and ADR-002, ADR-005, ADR-009, ADR-010 on 2026-10-05; later sections not yet reconciled  
**Version:** 1.1  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`, `05-data-model.md`, `06-architecture.md`  
**Decisions:** ADR-002 (`adr/0002-shared-contracts.md`), ADR-005 (`adr/0005-roles-and-authentication.md`), ADR-008 (`adr/0008-background-jobs-csv-import.md`), ADR-009 (`adr/0009-observability-scope.md`), ADR-010 (`adr/0010-v1-product-scope-clarifications.md`)

---

# 1. Purpose

**Status:** `Reference`

This document defines the HTTP API contract for Trading Analytics Platform:
authentication, portfolios, positions, transactions, assets, market data,
analytics, decisions, decision replay, scenarios, watchlists, alerts,
notifications and background operations.

Request and response schemas in `@trading/contracts` (ADR-002) are the source
of truth; this document describes them. The demo does not call a mock HTTP
API: it consumes the same DTOs through an in-process adapter (ADR-002
point 5), `Planned (FE)`.

---

# 2. API Principles

**Status:** `Reference`; per-principle status below.

| # | Principle | Status |
| --- | --- | --- |
| 1 | Resource-oriented HTTP APIs. | `Implemented` |
| 2 | Explicit DTOs built by presenters, never database or domain objects (ADR-002 point 4). | `Planned (B0)` |
| 3 | Consistent response structure (§4). | `Implemented` |
| 4 | Consistent error structure (§5). | `Implemented` |
| 5 | Explicit validation with Zod at the route boundary. | `Implemented`; schemas move to `@trading/contracts` `Planned (B0)` |
| 6 | Pagination for large collections. | `Implemented` |
| 7 | Filtering and sorting where required. | `Implemented` per endpoint |
| 8 | `Idempotency-Key` where duplicates are dangerous (ADR-008 point 8). | `Planned (B4)` |
| 9 | Versioned contracts, additive changes only within a version (ADR-002 point 8); OpenAPI generated from the schemas (ADR-002 point 7). | `Implemented` for versioning; OpenAPI `Planned (B6)` |
| 10 | Realtime events are separate from HTTP responses (`08-realtime-spec.md`). | `Planned (B5)` |

Wire format (ADR-002 point 3), `Implemented` for money and dates; enforced by
response schemas `Planned (B0)`:

- Money: `{ "amount": "<decimal string>", "currency": "USD" }`, never a number.
- Dates: ISO-8601 strings in UTC.
- Percentages and ratios: JSON numbers, display only.
- Identifiers: strings.

---

# 3. API Versioning

**Status:** `Implemented` (ADR-002 point 8)

Every business endpoint is under:

```text
/api/v1
```

Within `v1` only additive changes are allowed; a breaking change requires a
new version. Unversioned routes are operational only: `GET /health` and
`GET /health/ready` (not rate-limited), and `GET /`.

---

# 4. Base Response Model

**Status:** `Implemented`; response schemas `Planned (B0)` (ADR-002 point 2)

Successful responses wrap the payload in `data`:

```json
{
  "data": {}
}
```

Paginated collections add `meta`:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Only paginated endpoints return `meta`.

---

# 5. Error Response

**Status:** `Implemented` (`apps/api/src/middleware/error-handler.ts`, ADR-002 point 2)

Every error, including 404 for unknown routes and 429, uses one envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "requestId": "...",
    "details": []
  }
}
```

- `requestId` is always present and equals the `X-Request-ID` header (§8).
- `details` is optional. Errors raised as `AppError` include it (an empty
  array when there are none); body-parser, domain, rate-limit and unexpected
  errors omit it.
- `message` is English and meant for logs. Clients map `code` to a localized
  message (ADR-010 point 8).
- Unexpected errors return 500 `INTERNAL_ERROR` with a generic message; stack
  traces and internal details are never returned.

---

# 6. Error Codes

**Status:** `Implemented` (`AppErrorCode` in `apps/api/src/errors/app-error.ts`)

Codes are stable within `v1`; adding a code is an additive change.

| Code | HTTP | Raised today |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 (413 for an oversized body) | Request validation, malformed JSON, `Invalid*Error` and `Insufficient*Error` domain errors |
| `UNAUTHORIZED` | 401 | Missing or invalid Bearer token, invalid credentials |
| `FORBIDDEN` | 403 | Declared, not raised |
| `NOT_FOUND` | 404 | Unknown route; missing resource or another user's resource (never 403, ADR-005 point 12) |
| `CONFLICT` | 409 | Conflicting state changes |
| `RATE_LIMITED` | 429 | Rate limiters (§9) |
| `TIMEOUT` | — | Declared, not raised |
| `DEPENDENCY_ERROR` | — | Declared, not raised |
| `INTERNAL_ERROR` | 500 | Unexpected errors |

`FORBIDDEN` for a missing permission on an own resource is `Planned (B2)`
(ADR-005 point 2).

---

# 7. Validation Error

**Status:** `Implemented` (`apps/api/src/middleware/validate.ts`)

A validation failure returns 400 `VALIDATION_ERROR` with one `details` entry
per issue. `field` is the dot-joined path:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "requestId": "...",
    "details": [
      {
        "field": "quantity",
        "message": "Quantity must be greater than zero."
      }
    ]
  }
}
```

Invalid query parameters use the message
`The request contains invalid query parameters.`. A per-detail `code` exists
in the type but is not emitted.

---

# 8. Request Correlation

**Status:** `Implemented` for the header; log propagation `Planned (B3)` (ADR-009 point 5)

Every response carries:

```text
X-Request-ID
```

A client-supplied value matching `^[a-zA-Z0-9-]{1,64}$` is reused; otherwise
the API generates a UUID. The same value is the `requestId` of every error
envelope (§5). Propagation to every log line through `AsyncLocalStorage` is
`Planned (B3)`.

---

# 9. Authentication

**Status:** `Implemented` for login and current user; refresh, logout and roles `Planned (B2)` (ADR-005)

There is no self-registration; users come from the seed (ADR-005 point 10).
Protected endpoints require `Authorization: Bearer <accessToken>`; every
failure returns the same 401 `UNAUTHORIZED` `Authentication required.`.

Rate limits (ADR-005 point 12), `Implemented`, in memory per process, with
draft-7 `RateLimit` and `RateLimit-Policy` headers:

- All routes except health: 300 requests per 15 minutes per IP.
- `POST /api/v1/auth/login`: additionally 5 attempts per 15 minutes per IP.

| Endpoint | Status |
| --- | --- |
| `POST /api/v1/auth/login` | `Implemented`; ADR-005 response shape `Planned (B2)` |
| `GET /api/v1/auth/me` | `Implemented` |
| `POST /api/v1/auth/refresh` | `Planned (B2)` |
| `POST /api/v1/auth/logout` | `Planned (B2)` |

## Login

**Status:** `Implemented`; response shape change `Planned (B2)`

```text
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "user@example.com",
  "password": "..."
}
```

Response today (200). `token` is a JWT carrying `sub` and `role`, valid for
`JWT_EXPIRES_IN_SECONDS` (default 900, 15 minutes):

```json
{
  "data": {
    "user": { "id": "...", "email": "...", "displayName": "...", "role": "USER" },
    "session": { "token": "..." }
  }
}
```

Errors: 400 `VALIDATION_ERROR` (invalid email or empty password); 401
`UNAUTHORIZED` `Invalid credentials.` for every credential failure, so
accounts cannot be enumerated; 429 `RATE_LIMITED`.

`Planned (B2)` (ADR-005 points 1, 5 and 8): the response becomes
`{ user, session: { accessToken, expiresAt } }`, login sets the refresh-token
cookie (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth`), and
roles become `VIEWER`, `TRADER`, `ADMIN`.

---

## Current User

**Status:** `Implemented`

```text
GET /api/v1/auth/me
```

Requires a Bearer token. Reads the user from the database on every call and
returns `{ "data": { "user": { id, email, displayName, role } } }`. Returns
401 `UNAUTHORIZED` when the token is invalid or the user no longer exists.

---

## Refresh

**Status:** `Planned (B2)` (ADR-005 points 5-7)

```text
POST /api/v1/auth/refresh
```

Reads the refresh-token cookie and requires a custom request header (CSRF
defence). Issues a new access token and rotates the refresh token; reusing a
rotated token revokes the whole token family.

---

## Logout

**Status:** `Planned (B2)` (ADR-005 points 6-7)

```text
POST /api/v1/auth/logout
```

Requires the custom request header. Revokes the session and clears the
refresh cookie. An access token already issued stays valid until it expires
(at most 15 minutes).

---

# 10. Portfolio API

**Status:** `Implemented`; archived-portfolio guard `Planned (B0)` (ADR-010 point 5)

All endpoints require a Bearer token (§9) and are scoped to the caller: a
portfolio of another user returns 404 `NOT_FOUND`, the same as a missing one.
Payloads are serialized entities today; response schemas and presenters are
`Planned (B0)` (ADR-002).

| Endpoint | Status |
| --- | --- |
| `GET /api/v1/portfolios` | `Implemented` |
| `GET /api/v1/portfolios/:portfolioId` | `Implemented` |
| `POST /api/v1/portfolios` | `Implemented` |
| `PATCH /api/v1/portfolios/:portfolioId` | `Implemented`; 409 on archived `Planned (B0)` |
| `POST /api/v1/portfolios/:portfolioId/archive` | `Implemented` |

## List Portfolios

**Status:** `Implemented` (FR-008)

```text
GET /api/v1/portfolios
```

Returns 200 `{ "data": [portfolio] }` with all of the caller's portfolios,
archived ones included (`status = ARCHIVED`). No query parameters, no
pagination. The `status`, `page`, `pageSize` and `sort` parameters are
`Deferred`.

---

## Get Portfolio

**Status:** `Implemented` (FR-008)

```text
GET /api/v1/portfolios/:portfolioId
```

Returns 200 `{ "data": portfolio }`. Errors: 404 `NOT_FOUND`.

---

## Create Portfolio

**Status:** `Implemented` (FR-009)

```text
POST /api/v1/portfolios
```

Request (`description` optional; `baseCurrency` is a 3-letter code):

```json
{
  "name": "Growth Portfolio",
  "description": "Long-term growth strategy.",
  "baseCurrency": "USD"
}
```

Response (201):

```json
{
  "data": {
    "id": "...",
    "name": "Growth Portfolio",
    "description": "Long-term growth strategy.",
    "baseCurrency": "USD",
    "status": "ACTIVE"
  }
}
```

Errors: 400 `VALIDATION_ERROR` (schema or domain invariants).

---

## Update Portfolio

**Status:** `Implemented` (FR-010); archived guard `Planned (B0)`

```text
PATCH /api/v1/portfolios/:portfolioId
```

Request: `name` and/or `description`; at least one is required.
`baseCurrency` cannot change after creation. Returns 200 `{ "data": portfolio }`.

Errors: 400 `VALIDATION_ERROR`; 404 `NOT_FOUND`. `Planned (B0)`: 409
`CONFLICT` when the portfolio is archived (ADR-010 point 5).

---

## Archive Portfolio

**Status:** `Implemented` (FR-011)

```text
POST /api/v1/portfolios/:portfolioId/archive
```

Sets `status = ARCHIVED`; nothing is deleted. Idempotent: always 200, with
`meta.alreadyArchived` telling whether this call changed anything:

```json
{
  "data": { "id": "...", "status": "ARCHIVED" },
  "meta": { "alreadyArchived": false }
}
```

Errors: 404 `NOT_FOUND`. Hard deletion and unarchiving are `Deferred`.

`Planned (B0)` (ADR-010 point 5): an archived portfolio is read-only. Every
mutation scoped to it (update, transactions, CSV imports) returns 409
`CONFLICT` and writes nothing; reads and the archive call are unchanged.

---

# 11. Portfolio Overview

**Status:** `Implemented` (FR-004); period `performance` field `Planned (B1)` (ADR-004, `16-analytics-spec.md` §11-§15)

```text
GET /api/v1/portfolios/:portfolioId/overview
```

Returns 200 with one purpose-specific payload, so the dashboard does not
orchestrate many requests:

```text
portfolio
summary              total market value, cost basis, unrealized P/L and percent
positions            [{ position, asset, metrics, allocationPercent, dailyChange }]
allocation
attribution          current-state attribution
recentTransactions   [{ transaction, asset }]
dailyChange          null when no held asset has a market price
pulse
```

An empty portfolio returns zeroed totals in `baseCurrency`, empty lists and a
non-null `dailyChange`. Errors: 404 `NOT_FOUND`.

---

# 12. Position API

**Status:** `Implemented`

| Endpoint | Status |
| --- | --- |
| `GET /api/v1/portfolios/:portfolioId/positions` | `Implemented` |
| `GET /api/v1/portfolios/:portfolioId/positions/:positionId` | `Implemented` |

Positions are derived from transactions and are read-only (ADR-003).

## List Positions

**Status:** `Implemented` (FR-012)

```text
GET /api/v1/portfolios/:portfolioId/positions
```

Returns 200 `{ "data": [position] }`, unpaginated. A fully sold position no
longer appears. The `assetType`, `sort`, `direction`, `page` and `pageSize`
parameters are `Deferred`. Errors: 404 `NOT_FOUND`.

---

## Get Position

**Status:** `Implemented` (FR-013)

```text
GET /api/v1/portfolios/:portfolioId/positions/:positionId
```

Returns the position with derived metrics:

```json
{
  "data": {
    "position": {},
    "metrics": {
      "marketValue": { "amount": "12000", "currency": "USD" },
      "costBasis": { "amount": "10000", "currency": "USD" },
      "unrealizedPnL": { "amount": "2000", "currency": "USD" },
      "unrealizedPnLPercent": 20
    }
  }
}
```

`allocation` is not returned here; it is in the overview
(`positions[].allocationPercent`, §11). Errors: 404 `NOT_FOUND` when the
position belongs to another portfolio or user. `BUY` fees in
`averageEntryPrice` are `Planned (B1)` (ADR-004 point 15).

---

# 13. Transaction API

**Status:** `Implemented`; `Idempotency-Key` `Planned (B4)` (ADR-008 point 8)

| Endpoint | Status |
| --- | --- |
| `GET /api/v1/portfolios/:portfolioId/transactions` | `Implemented` |
| `GET /api/v1/portfolios/:portfolioId/transactions/:transactionId` | `Implemented` |
| `POST /api/v1/portfolios/:portfolioId/transactions` | `Implemented` |

Only `BUY` and `SELL` exist; there is no cash balance and no cash validation
(ADR-003). Transactions are immutable: no update or delete endpoint.

## List Transactions

**Status:** `Implemented` (FR-014, FR-016)

```text
GET /api/v1/portfolios/:portfolioId/transactions
```

Filters, combined with AND:

```text
assetId
type        BUY | SELL
dateFrom    ISO-8601
dateTo      ISO-8601
page        default 1
pageSize    default 20, max 100
```

Ordered by `executedAt` descending, then `id` descending; `sort` is
`Deferred`. Response (200):

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
}
```

Errors: 400 `VALIDATION_ERROR` (invalid filter); 404 `NOT_FOUND`.

---

## Get Transaction

**Status:** `Implemented` (FR-014)

```text
GET /api/v1/portfolios/:portfolioId/transactions/:transactionId
```

Returns 200 `{ "data": transaction }`. Errors: 404 `NOT_FOUND` when the
transaction belongs to another portfolio or user.

---

## Create Transaction

**Status:** `Implemented` (FR-017, FR-018); see Planned rules below

```text
POST /api/v1/portfolios/:portfolioId/transactions
```

Request (`fees` and `executedAt` optional; `amount` is a decimal string or a
number):

```json
{
  "assetId": "asset_001",
  "type": "BUY",
  "quantity": 10,
  "price": { "amount": "150", "currency": "USD" },
  "fees": { "amount": "2.5", "currency": "USD" },
  "executedAt": "2026-08-29T14:30:00Z"
}
```

Synchronous: the transaction is persisted and its position recalculated in
one unit of work (ADR-008 point 12). Response (201); `position` is `null`
when a `SELL` closes the position:

```json
{
  "data": {
    "transaction": { "id": "...", "status": "COMPLETED" },
    "position": {}
  }
}
```

Errors: 400 `VALIDATION_ERROR` (schema, domain invariants, `SELL` above the
held quantity); 404 `NOT_FOUND` (portfolio or `assetId`).

`Planned`:

- (B0) Chronological validation of backdated transactions (ADR-003 point 6);
  409 `CONFLICT` on an archived portfolio (ADR-010 point 5).
- (B1) 400 when a `SELL` has `fees > quantity × price`, or the asset currency
  differs from `baseCurrency` (ADR-004 points 2 and 12).
- (B4) `Idempotency-Key` header: the same key and request returns the stored
  response; a different request returns 409 `CONFLICT` (ADR-008 point 8).

---

# 14. Transaction Processing

**Status:** asynchronous transaction creation removed (ADR-008 point 12); CSV import `Planned (B4)` (FR-080)

Transaction creation is synchronous (§13); there is no job for a single
transaction. Background jobs exist only for CSV transaction import:

```text
POST /api/v1/portfolios/:portfolioId/imports
```

`Planned (B4)` (ADR-008 points 1-2, 8-10): creates an import job and returns
it in `QUEUED`. Every row is validated first; if any row fails, the job ends
`FAILED` with a per-row report and nothing is written. Valid rows are applied
in one unit of work. Rows follow the §13 rules (`BUY` and `SELL` only). File
size and row count are bounded (values fixed in B4). Accepts
`Idempotency-Key`.

---

# 15. Transaction Job Status

**Status:** `Planned (B4)` (ADR-008 points 3 and 9, FR-081)

```text
GET /api/v1/jobs/:jobId
```

Response:

```json
{
  "data": {
    "id": "job_001",
    "status": "PROCESSING",
    "progress": { "processed": 60, "total": 100 }
  }
}
```

Statuses:

```text
QUEUED
PROCESSING
COMPLETED
FAILED
CANCELLED
TIMED_OUT
```

Progress is a field, not a state. `FAILED` carries a reason:
`VALIDATION_FAILED`, `INTERRUPTED`, `APPLY_ERROR` or `APPLY_REJECTED`.
Ownership is checked; another user's job returns 404.

---

# 16. Retry Failed Job

**Status:** `Planned (B4)` (ADR-008 point 6, FR-081)

```text
POST /api/v1/jobs/:jobId/retry
POST /api/v1/jobs/:jobId/cancel
```

Retry returns the job to `QUEUED` and increments `attempt`. It is allowed for
`TIMED_OUT`, `CANCELLED`, and `FAILED` with reason `INTERRUPTED`,
`APPLY_ERROR` or `APPLY_REJECTED`; `VALIDATION_FAILED` is not retryable (the
user fixes the file and creates a new import). Cancel is allowed while
`QUEUED` or validating, never during the apply stage.

---

# 17. Asset API

## List Assets

```text
GET /api/v1/assets
```

Filters:

```text
search
assetType
exchange
currency
status
page
pageSize
```

---

## Get Asset

```text
GET /api/v1/assets/:assetId
```

---

## Asset Price

```text
GET /api/v1/assets/:assetId/price
```

Response:

```text
{
  "data": {
    "assetId": "...",
    "price": 184.22,
    "previousPrice": 181.40,
    "change": 2.82,
    "changePercent": 1.55,
    "timestamp": "...",
    "source": "MOCK"
  }
}
```

---

# 18. Historical Market Data

```text
GET /api/v1/assets/:assetId/history
```

Parameters:

```text
from
to
interval
```

Example intervals:

```text
1m
5m
15m
1h
1d
```

---

# 19. Market Data Batch Endpoint

For dashboards displaying multiple assets:

```text
GET /api/v1/market/prices
```

Parameters:

```text
assetIds
```

This avoids excessive individual requests.

---

# 20. Analytics API

## Portfolio Performance

```text
GET /api/v1/portfolios/:portfolioId/analytics/performance
```

Optional:

```text
from
to
interval
```

---

## Allocation

```text
GET /api/v1/portfolios/:portfolioId/analytics/allocation
```

Optional grouping:

```text
asset
assetType
currency
sector
```

---

## Risk

```text
GET /api/v1/portfolios/:portfolioId/analytics/risk
```

Potential response:

```text
{
  "data": {
    "volatility": 14.2,
    "maxDrawdown": -8.4,
    "concentration": 0.32,
    "riskLevel": "MODERATE"
  }
}
```

---

# 21. Portfolio Pulse API

```text
GET /api/v1/portfolios/:portfolioId/pulse
```

Response:

```text
{
  "data": {
    "overall": "HEALTHY",
    "dimensions": {
      "performance": {},
      "concentration": {},
      "volatility": {},
      "drawdown": {},
      "exposure": {}
    },
    "explanations": []
  }
}
```

The pulse must remain explainable.

---

# 22. Attribution API

```text
GET /api/v1/portfolios/:portfolioId/analytics/attribution
```

Optional parameters:

```text
from
to
groupBy
```

Possible grouping:

```text
asset
assetType
sector
```

---

# 23. Decision API

## List Decisions

```text
GET /api/v1/portfolios/:portfolioId/decisions
```

Filters:

```text
assetId
direction
dateFrom
dateTo
```

> **Implementation note (diverges from the original spec).** `outcome`,
> `page` and `pageSize` are not implemented. A portfolio holds a small
> number of decisions, `outcome` is a free-form string with no useful
> filter semantics yet, and `DecisionRepository.listByPortfolioId`
> returns a plain array. The response is `{ "data": [...] }` without
> `meta`. Revisit if decision volume or an enumerated outcome justifies
> it (NFR-070).

---

## Get Decision

```text
GET /api/v1/portfolios/:portfolioId/decisions/:decisionId
```

---

> **Deferred (not implemented).** Create, Update and Close Decision
> (the three endpoints below) are intentionally deferred. No functional
> requirement asks for them (FR-032/033/034 are read and replay only),
> and decision events cannot be generated honestly by the service: there
> is no `DECISION_CLOSED` event type, `POSITION_CLOSED` needs an exit
> price the close endpoint does not receive, and `Decision` has no link
> to `Transaction` from which position events could be derived. Writing
> decisions properly also requires extending `UnitOfWork` so a decision
> and its events are created atomically (FR-074). Decisions currently
> come from seed/demo data. If the frontend needs to create decisions,
> design this together with an event journal endpoint
> (`POST .../decisions/:decisionId/events`) once the screen exists.

## Create Decision

```text
POST /api/v1/portfolios/:portfolioId/decisions
```

Request:

```text
{
  "assetId": "asset_001",
  "title": "Breakout setup",
  "thesis": "Price structure suggests...",
  "direction": "LONG",
  "entryPrice": 180,
  "targetPrice": 195,
  "stopPrice": 174,
  "riskLevel": "MODERATE"
}
```

---

## Update Decision

```text
PATCH /api/v1/portfolios/:portfolioId/decisions/:decisionId
```

---

## Close Decision

```text
POST /api/v1/portfolios/:portfolioId/decisions/:decisionId/close
```

---

# 24. Decision Replay API

## Get Replay Timeline

```text
GET /api/v1/decisions/:decisionId/replay
```

Response:

```text
{
  "data": {
    "decision": {},
    "events": [],
    "currency": "USD",
    "initialState": {}
  }
}
```

The client controls playback.

> **Implementation note.** `events` are returned in chronological order.
> `currency` is the asset's currency: event payload prices are plain
> numbers interpreted in it, so a client folding the timeline needs it.
> `initialState` is the projection before the first event
> (`currentIndex = -1`). The client advances by folding events with the
> same pure `projectDecisionReplay` function from `@trading/domain`
> that the server uses, which keeps the public demo identical.
> Ownership is resolved decision → portfolio → user; a missing decision
> and another user's decision both return the same 404.

---

# 25. Scenario API

## List Scenarios

```text
GET /api/v1/portfolios/:portfolioId/scenarios
```

> **Implementation note.** Returns `{ "data": [...] }`, each scenario
> including its `changes`, newest first. An optional `status` filter
> (`DRAFT`, `SAVED`, `ARCHIVED`) is added so a client can hide archived
> scenarios; the spec defines no filters. Not paginated (a portfolio
> holds few scenarios). `GET .../scenarios/:scenarioId` returns a single
> scenario the same way.

---

## Create Scenario

```text
POST /api/v1/portfolios/:portfolioId/scenarios
```

Request:

```text
{
  "name": "Increase technology exposure",
  "description": "Evaluate higher technology allocation."
}
```

---

## Calculate Scenario

```text
POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/calculate
```

Response:

```text
{
  "data": {
    "scenarioId": "...",
    "baseline": {},
    "result": {},
    "difference": {},
    "unmatchedAssetIds": []
  }
}
```

> **Implementation note.** Stateless: it combines the scenario's stored
> `changes` with the portfolio's current positions and writes nothing
> (results are derived, `05-data-model.md` §16), so the baseline cannot
> be modified (FR-036). `baseline` and `result` are portfolio metrics
> (`totalValue`, `investedValue`, `unrealizedPnL`,
> `unrealizedPnLPercent`); `difference` has `totalValue` and
> `unrealizedPnL`. Allocation, risk and exposure from FR-038 are not
> computed yet because the domain cannot derive them honestly.
> `unmatchedAssetIds` lists assets the scenario changes but the
> portfolio no longer holds, which the calculation ignores. Any
> status, including `ARCHIVED`, can be calculated.

---

## Update Scenario

```text
PATCH /api/v1/portfolios/:portfolioId/scenarios/:scenarioId
```

---

## Archive Scenario

```text
POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/archive
```

> **Implementation note (write side).** The spec left the write bodies
> open; this is what is implemented.
>
> - `POST .../scenarios` body: `name` (required), `description?`,
>   `changes?` (`[{ assetId, percentChange }]`, default none). Returns
>   201 with the scenario as a `DRAFT`.
> - `PATCH .../scenarios/:scenarioId` body: any of `name`, `description`,
>   `status` (`DRAFT` or `SAVED` only), `changes`; at least one is
>   required. `changes` REPLACES the whole list, so `changes: []` is the
>   reset (FR-039) and `status: "SAVED"` is save (FR-040); they need no
>   endpoints of their own. The update is a single write, so a request
>   that is partly invalid changes nothing.
> - `POST .../archive` is idempotent (always 200, `meta.alreadyArchived`
>   says whether it changed anything), like archiving a portfolio.
>   An archived scenario is read-only: `PATCH` returns 409 `CONFLICT`,
>   and there is no un-archive.
> - `DELETE .../scenarios/:scenarioId` returns 204 for any status
>   (FR-043).
> - A change is `{ assetId, percentChange }`: a percentage change to the
>   asset's price, never below -100%, one entry per asset. Unknown
>   assets are a 400 listing all of them (`UNKNOWN_ASSET`), not a 404,
>   because the missing thing is a body field. The portfolio does not
>   have to hold the asset.
> - Not implemented: duplicate (FR-041, P2).
>
> **Compare Scenarios (FR-042).** Not in the original spec; added as
> `POST /api/v1/portfolios/:portfolioId/scenarios/compare` with body
> `{ "scenarioIds": [...] }`: 1 to 5 distinct ids, all belonging to the
> portfolio (any missing or foreign id makes the whole request a 404, so
> a column is never silently dropped). Read-only (200, nothing written),
> so the baseline cannot change. It exists because totals alone
> (`calculate`) cannot show *which asset explains a difference* or *how
> allocation shifts*, which `01-product-spec.md` §15.2 asks for.
> Response: `baseline` (`metrics` plus one row per asset with `value` and
> `allocationPercent`, largest first) and `scenarios` in the requested
> order, each with `scenarioId`, `name`, `status`, `metrics`,
> `difference` (`totalValue`, `totalValuePercent` which is `null` when
> the baseline is zero, and `unrealizedPnL`), `unmatchedAssetIds`, and
> `assets` rows with `value`, `valueDifference`, `allocationPercent` and
> `allocationShift` (percentage points), ordered by the size of the
> difference. Each asset row carries `symbol` and `name`. Allocation is
> per asset only (no asset type or sector). Computed by the pure domain
> function `compareScenarioImpacts`, shared with the demo.

---

# 26. Watchlist API

## Get Watchlist

```text
GET /api/v1/watchlist
```

---

## Add Asset

```text
POST /api/v1/watchlist
```

Request:

```text
{
  "assetId": "asset_001"
}
```

---

## Remove Asset

```text
DELETE /api/v1/watchlist/:assetId
```

Duplicate additions should return a conflict or equivalent idempotent response.

**Implementation note (Step D):** duplicate additions return `400
VALIDATION_ERROR` (the repository's `@@unique([userId, assetId])`
constraint surfaces as the domain's `InvalidWatchlistItemError`, mapped
by the generic `Invalid*Error → 400` handler), not `409 CONFLICT` as
"conflict" above might suggest. Removing a nonexistent entry returns
`404 NOT_FOUND`. Adding a nonexistent `assetId` returns `404 NOT_FOUND`.
Watchlist uniqueness is per user, not global — two different users may
watch the same asset.

---

# 27. Alerts API

## List Alerts

```text
GET /api/v1/alerts
```

---

## Create Alert

```text
POST /api/v1/alerts
```

Request:

```text
{
  "assetId": "asset_001",
  "type": "PRICE",
  "condition": "ABOVE",
  "threshold": 200,
  "enabled": true
}
```

---

## Update Alert

```text
PATCH /api/v1/alerts/:alertId
```

---

## Delete Alert

```text
DELETE /api/v1/alerts/:alertId
```

**Implementation note (Step D):** an alert must reference an asset, a
portfolio, or both — enforced both by the request schema and by the
domain's `validateNewAlert`. If `portfolioId` is given, it must belong
to the caller (`404 NOT_FOUND` otherwise). Update only accepts
`condition`/`threshold`/`enabled`; the target (`assetId`/`portfolioId`/
`type`) is immutable after creation — changing what an alert monitors
is a new alert. `GET /api/v1/alerts/:alertId` (not listed above) also
exists, following the same get-by-id shape used by Positions/
Transactions. Nothing evaluates alert conditions against live prices
yet — that lands with the realtime/market-simulation work (FR-053).

---

# 28. Notifications API

## List Notifications

```text
GET /api/v1/notifications
```

Parameters:

```text
unreadOnly
```

**Implementation note (Step D):** the parameters above are the
original design intent; the shipped filter is `unreadOnly` (boolean),
matching exactly what `NotificationRepository.listByUserId` supports.
`read`/`type`/`page`/`pageSize` are not implemented — a two-way `read`
filter, filtering by `type`, and pagination are all deferred until a
concrete need appears (03-non-functional-requirements.md NFR-070:
complexity proportional to an actual requirement, not anticipated
usage). There is no `POST /api/v1/notifications` — notifications are
produced by system events (transaction completed, alert triggered,
job events), not created directly by API callers; that production path
is not implemented yet either (belongs with Realtime/Background
Operations, Phases 9-10 of `15-implementation-plan.md`).

---

## Mark Notification Read

```text
POST /api/v1/notifications/:notificationId/read
```

---

## Mark All Read

```text
POST /api/v1/notifications/read-all
```

---

# 29. User Preferences API

## Get Preferences

```text
GET /api/v1/preferences
```

---

## Update Preferences

```text
PATCH /api/v1/preferences
```

Example:

```text
{
  "theme": "dark",
  "language": "en",
  "reducedMotion": false
}
```

**Implementation note (Step D):** preferences are a per-user singleton
row, created lazily on the first `PATCH` (an atomic upsert, not a
separate create step). `GET` for a user who has never saved
preferences returns `200` with `data: null`, not `404` — absence of
saved preferences is a valid state (same principle as the null
`dailyChange` in the portfolio overview), and a read must not have the
side effect of creating a row. `PATCH` requires at least one field.
`defaultPortfolioId` may be set to `null` to clear it, or to a
portfolio id the caller owns (`404 NOT_FOUND` if it belongs to someone
else). Omitted fields on the very first `PATCH` fall back to the
column defaults declared in `schema.prisma` (`theme="system"`,
`language="en"`, `reducedMotion=false`, `notificationPreferences={}`),
kept there as the single source of truth rather than duplicated here.

---

# 30. Health API

```text
GET /api/v1/health
```

Response:

```text
{
  "data": {
    "status": "healthy",
    "timestamp": "...",
    "dependencies": {
      "database": "healthy",
      "cache": "healthy",
      "realtime": "healthy"
    }
  }
}
```

---

# 31. Realtime API

Realtime communication is separate from the HTTP API.

The production implementation may use:

- WebSockets;
- Server-Sent Events;
- another appropriate realtime transport.

The client must consume a normalized internal event contract.

---

# 32. Realtime Event Envelope

```text
{
  "id": "event_001",
  "type": "MARKET_PRICE_UPDATED",
  "timestamp": "...",
  "sequence": 1001,
  "payload": {}
}
```

---

# 33. Market Price Event

```text
{
  "type": "MARKET_PRICE_UPDATED",
  "payload": {
    "assetId": "asset_001",
    "price": 184.22,
    "previousPrice": 183.90
  }
}
```

---

# 34. Portfolio Event

Example:

```text
{
  "type": "PORTFOLIO_UPDATED",
  "payload": {
    "portfolioId": "portfolio_001",
    "reason": "TRANSACTION_COMPLETED"
  }
}
```

The event does not need to contain the complete portfolio.

The client can fetch or derive the affected state.

---

# 35. Job Progress Event

```text
{
  "type": "JOB_PROGRESS_UPDATED",
  "payload": {
    "jobId": "job_001",
    "status": "PROCESSING",
    "progress": 75
  }
}
```

---

# 36. Notification Event

```text
{
  "type": "NOTIFICATION_CREATED",
  "payload": {
    "notificationId": "notification_001"
  }
}
```

---

# 37. Realtime Connection Events

The client should receive normalized connection state:

```text
CONNECTED
DISCONNECTED
RECONNECTING
RECONNECTED
FAILED
```

These are transport/application events and should not be treated as domain entities.

---

# 38. Event Ordering

The client must reject or ignore stale events where:

```text
incomingSequence <= lastProcessedSequence
```

when sequence ordering is available.

This prevents older market events from overwriting newer state.

---

# 39. Idempotency

Mutations with potentially duplicate execution should support idempotency.

Example:

```text
Idempotency-Key: <unique-key>
```

Potential candidates:

- transaction creation;
- deposits;
- withdrawals;
- long-running jobs.

The demo should simulate duplicate requests where useful.

---

# 40. Pagination

Collection endpoints should support:

```text
page
pageSize
```

Default:

```text
page = 1
pageSize = 20
```

Maximum page size should be bounded.

---

# 41. Filtering

Filtering parameters should use predictable naming.

Examples:

```text
status
type
assetId
dateFrom
dateTo
```

Complex filters should not be encoded into arbitrary query strings.

---

# 42. Sorting

Sorting may use:

```text
sort=createdAt
sort=-createdAt
```

Multiple sort fields may be supported later.

---

# 43. Date Handling

API timestamps should use ISO 8601.

Example:

```text
2026-08-29T14:30:00Z
```

Timezone conversion belongs to the presentation layer unless business rules explicitly require timezone-aware calculations.

---

# 44. Monetary Values

Monetary API fields must have predictable precision.

The API should avoid ambiguous representations.

Possible implementation:

```text
{
  "amount": "12345.67",
  "currency": "USD"
}
```

The final representation will be standardized before implementation.

---

# 45. API Security

The API must enforce:

- authentication;
- authorization;
- input validation;
- ownership checks;
- rate limiting where applicable;
- safe error responses.

Client-side authorization is not sufficient.

---

# 46. Resource Ownership

A user must only access resources they own or are authorized to access.

Example:

```text
GET /api/v1/portfolios/:portfolioId
```

must verify:

```text
authenticatedUser
        ↓
portfolio.owner
```

before returning the resource.

---

# 47. API Rate Limiting

Production APIs should implement reasonable rate limits.

The exact thresholds will be defined during deployment.

The demo should not depend on external rate-limiting infrastructure.

A local simulation may reproduce rate-limit responses for demonstration and testing.

---

# 48. API Timeout Behavior

Requests should have defined timeout behavior.

When a dependency times out:

```text
Dependency Timeout
      ↓
Normalize Error
      ↓
TIMEOUT / DEPENDENCY_ERROR
      ↓
Client Recovery UX
```

The demo should be capable of simulating this condition.

---

# 49. Mock API Contract

The mock implementation must expose the same application operations as the production API.

Example:

```text
PortfolioService
     │
     ├── MockPortfolioService
     └── ApiPortfolioService
```

Both must satisfy the same contract.

---

# 50. Mock API Behavior

The mock API should simulate:

- asynchronous requests;
- latency;
- validation;
- successful mutations;
- failed mutations;
- timeouts;
- retries;
- realtime events;
- background processing.

Example:

```text
UI
 ↓
Mock API
 ↓
Simulated Network Delay
 ↓
Application Logic
 ↓
Mock Repository
 ↓
Domain Calculation
 ↓
Response
```

---

# 51. Mock API and Real API Parity

The following must remain equivalent:

```text
Request shape
Response shape
Error shape
Validation behavior
State transitions
Domain calculations
```

Only the infrastructure implementation changes.

---

# 52. Demo-Only Endpoints

Demo-specific controls should not be part of the production API contract.

Examples may include:

```text
POST /demo/reset
POST /demo/simulation/start
POST /demo/simulation/stop
POST /demo/failures
```

These belong to a separate demo controller.

---

# 53. Demo Reset

Conceptually:

```text
POST /demo/reset
```

Result:

```text
Seed Data
    ↓
Fresh Session
```

The endpoint is unavailable in production mode.

---

# 54. Demo Simulation Controls

Potential operations:

```text
POST /demo/simulation/start
POST /demo/simulation/pause
POST /demo/simulation/resume
POST /demo/simulation/stop
```

The exact controls may be exposed through a developer/demo panel rather than the primary product UI.

---

# 55. Demo Failure Simulation

Potential categories:

```text
API_ERROR
TIMEOUT
NETWORK_ERROR
REALTIME_DISCONNECT
JOB_FAILURE
VALIDATION_ERROR
```

The simulation must never corrupt the seed dataset.

---

# 56. API Contract Testing

The mock implementation should be tested against the same schemas used to validate the production implementation.

Conceptually:

```text
Shared Contract
      │
 ┌────┴────┐
 ↓         ↓
Mock      Real
API       API
 ↓         ↓
Contract Tests
```

This prevents the demo from drifting away from the real application.

---

# 57. API Documentation

The production API should expose machine-readable documentation.

OpenAPI is the preferred candidate.

The specification should define:

- endpoints;
- parameters;
- request schemas;
- response schemas;
- error schemas;
- authentication;
- examples.

The final implementation will determine the exact tooling.

---

# 58. API Evolution

Breaking changes must require a versioning strategy.

Examples:

```text
v1 → v2
```

Non-breaking additions should be preferred when possible.

---

# 59. API Quality Gates

The API specification is considered acceptable when:

- every core product operation has a defined contract;
- request and response structures are explicit;
- errors are normalized;
- validation behavior is predictable;
- resource ownership is enforced;
- realtime events have normalized envelopes;
- mock and production implementations share contracts;
- asynchronous operations expose lifecycle state;
- pagination/filtering conventions are consistent;
- monetary and timestamp handling are explicit;
- demo-only infrastructure remains isolated.

---

# 60. Final API Principle

The API should represent **application capabilities**, not database tables.

The important question is not:

> “How do we expose this table?”

but:

> “What operation does the product need to perform?”

Therefore the API should remain centered around meaningful capabilities such as:

```text
Create Transaction
Calculate Scenario
Replay Decision
Get Portfolio Overview
Analyze Performance
Track Market Updates
```

rather than becoming a thin CRUD mirror of the database.

---

# 61. Contract Strategy Summary

The final architecture is:

```text
                     Application
                         │
                    API Contract
                         │
              ┌──────────┴──────────┐
              │                     │
         Mock Adapter          Real Adapter
              │                     │
        Mock Repository          HTTP API
              │                     │
        Simulation Engine       Backend
              │                     │
          Seed/Session          Database
              │
              └──────────┬──────────┘
                         ↓
                   Same Domain
                    Behavior
```

This guarantees that the public demo remains a legitimate implementation of the product rather than a static prototype.
