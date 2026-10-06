# SDD 07 — API Specification

**Project:** Trading Analytics Platform  
**Status:** All sections reconciled with the code and ADRs on 2026-10-05  
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
| `FORBIDDEN` | 403 | Declared, not raised; role checks `Planned (B2)` (ADR-002 point 10) |
| `NOT_FOUND` | 404 | Unknown route; missing resource or another user's resource (never 403, ADR-005 point 12) |
| `CONFLICT` | 409 | Conflicting state changes |
| `RATE_LIMITED` | 429 | Rate limiters (§9) |
| `TIMEOUT` | — | Declared, not raised; removed from `AppErrorCode` `Planned (B0)` (ADR-002 point 10) |
| `DEPENDENCY_ERROR` | 503 `Planned (B0)` | Declared, not raised; database unreachable (ADR-002 point 10) |
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
in the type but is not emitted. `Planned (B0)` (ADR-002 point 10): each entry
is `{ field, code, message }`, where `code` is the Zod issue code (for
example `too_small`) so the client can localize it (ADR-010 point 8).

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
`QUEUED` or validating, never during the apply stage. Retry or cancel in a
state that does not allow it returns 409 `CONFLICT` and changes nothing
(ADR-008 point 6).

---

# 17. Asset API

**Status:** `Implemented` (FR-019 to FR-021); asset volatility, exposure and related positions in the detail `Deferred` (FR-021)

Assets are shared reference data: every endpoint requires a Bearer token
(§9) but has no ownership check. Prices are `Money`
(`{ amount, currency }`, ADR-002); payloads are serialized entities today,
presenters `Planned (B0)` (ADR-002).

| Endpoint | Status |
| --- | --- |
| `GET /api/v1/assets` | `Implemented` |
| `GET /api/v1/assets/:assetId` | `Implemented` |
| `GET /api/v1/assets/:assetId/price` | `Implemented` |
| `GET /api/v1/assets/:assetId/history` | `Implemented` (§18) |

## List Assets

**Status:** `Implemented` (FR-019, FR-020)

```text
GET /api/v1/assets
```

Query (all optional):

```text
search      1-100 characters
assetType   STOCK | ETF | CRYPTO | FOREX
exchange    1-50 characters
currency    3-letter code, uppercased
status      ACTIVE | INACTIVE
page        integer ≥ 1, default 1
pageSize    integer 1-100, default 20
```

Returns 200 `{ "data": [asset], "meta": { page, pageSize, total, totalPages } }`.
Errors: 400 `VALIDATION_ERROR`.

---

## Get Asset

**Status:** `Implemented` (FR-021)

```text
GET /api/v1/assets/:assetId
```

Returns 200 `{ "data": asset }`. Errors: 404 `NOT_FOUND`.

---

## Asset Price

**Status:** `Implemented` (FR-021); change semantics against the last closed candle `Planned (B5)` (ADR-007 point 14)

```text
GET /api/v1/assets/:assetId/price
```

Response (200):

```json
{
  "data": {
    "assetId": "...",
    "price": { "amount": "184.22", "currency": "USD" },
    "previousPrice": { "amount": "181.40", "currency": "USD" },
    "change": { "amount": "2.82", "currency": "USD" },
    "changePercent": 1.55,
    "timestamp": "...",
    "source": "MOCK"
  }
}
```

`source` is `MOCK` or `EXTERNAL`. Errors: 404 `NOT_FOUND` when the asset
does not exist, and also when it exists but has no current price (different
messages; assets have no ownership to protect).

---

# 18. Historical Market Data

**Status:** `Implemented` (FR-021); daily candle closing by the simulator `Planned (B5)` (ADR-007 point 8)

```text
GET /api/v1/assets/:assetId/history
```

Query:

```text
from        date, required
to          date, required, from ≤ to
interval    1d (default); the only value accepted
```

Returns 200 `{ "data": [candle] }`, daily candles in the range, each
`{ assetId, timestamp, open, high, low, close, volume }` with
`open`/`high`/`low`/`close` as `Money` and `volume` a number. An empty range
returns `[]`. Errors: 400 `VALIDATION_ERROR` (missing dates, `from > to`,
another `interval`); 404 `NOT_FOUND` (asset). Intraday intervals
(`1m`, `5m`, `15m`, `1h`) are `Deferred`: only daily candles exist.

---

# 19. Market Data Batch Endpoint

**Status:** `Implemented`; realtime updates (FR-044) `Planned (B5)` (§31-§33)

```text
GET /api/v1/market/prices?assetIds=id1,id2
```

`assetIds` is a comma-separated list of 1 to 50 ids. Returns 200
`{ "data": [marketPrice] }` with the §17 price shape. Unknown ids and assets
without a current price are omitted, never 404. Errors: 400
`VALIDATION_ERROR`.

---

# 20. Analytics API

**Status:** allocation `Implemented` (FR-027); performance and risk `Planned (B1)` (FR-025, FR-026, FR-028, FR-029, FR-085; ADR-004)

All endpoints require a Bearer token and portfolio ownership (another
user's portfolio returns 404 `NOT_FOUND`). Money fields are `Money`;
returns and percentages are unrounded numbers in percentage points
(`16-analytics-spec.md` §2).

| Endpoint | Status |
| --- | --- |
| `GET /api/v1/portfolios/:portfolioId/analytics/allocation` | `Implemented` |
| `GET /api/v1/portfolios/:portfolioId/analytics/performance` | `Planned (B1)` |
| `GET /api/v1/portfolios/:portfolioId/analytics/risk` | `Planned (B1)` |
| `GET /api/v1/portfolios/:portfolioId/analytics/attribution` | §22 |

## Portfolio Performance

**Status:** `Planned (B1)` (FR-025, FR-026, FR-085; `16-analytics-spec.md` §5, §7, §8); `1D` `Implemented` as `dailyChange` in §11

```text
GET /api/v1/portfolios/:portfolioId/analytics/performance
```

Query: `period` (`1D`, `1W`, `1M`, `3M`, `6M`, `1Y`, `YTD`, `ALL`) or a
custom `from` / `to` (UTC dates, inclusive). They are mutually exclusive:
sending both is 400 `VALIDATION_ERROR`; the default is `1M` (ADR-002 point
10). Response fields (ADR-002 point 10; semantics in `16`):

```text
asOf            effective end date (to clamped to the last closed day)
effectiveFrom   first day on which every held asset has a price (§5 clamp)
status          OK | INSUFFICIENT_DATA | UNKNOWN
twrPercent      number, percentage points, unrounded; null when TWR has no value
pnl             Money over the same days as TWR; null when unavailable
series          [{ date, value, returnPercent }]; date is a UTC calendar date, value is Money (FR-026, 16 §3)
```

Unavailable values are `null`, never `0` (ADR-002 point 10).

Errors: 400 `VALIDATION_ERROR` when `from > to`. A valid range with no
closed day (`asOf < from`) returns 200 with `status: "INSUFFICIENT_DATA"` and `asOf`,
not 400 (`16` §8). Benchmark comparison is `Deferred` (ADR-010 point 7).
Money-weighted return is not reported.

---

## Allocation

**Status:** `Implemented` (FR-027; `16-analytics-spec.md` §13); sector `Deferred` (ADR-004 point 13)

```text
GET /api/v1/portfolios/:portfolioId/analytics/allocation
```

Query: `groupBy` = `asset` (default) | `assetType` | `currency`.

Response (200):

```json
{
  "data": {
    "groupBy": "asset",
    "groups": [
      {
        "key": "asset_001",
        "label": "AAPL",
        "marketValue": { "amount": "1842.20", "currency": "USD" },
        "percentage": 61.4
      }
    ]
  }
}
```

An empty portfolio returns `groups: []`. Errors: 400 `VALIDATION_ERROR`;
404 `NOT_FOUND`. Mixed currencies surface as 500 today; 400 on the
transaction is `Planned (B1)` (`16` §2).

---

## Risk

**Status:** `Planned (B1)` (FR-028, FR-029; `16-analytics-spec.md` §9, §10)

```text
GET /api/v1/portfolios/:portfolioId/analytics/risk
```

Portfolio-level volatility and drawdown on the daily series over the
requested period (same query, `asOf` and `effectiveFrom` as performance):

```text
status                  OK | INSUFFICIENT_DATA | UNKNOWN
volatilityPercent       annualized (√365), percentage points; null when fewer than 20 returns
maxDrawdownPercent      negative percentage; null when fewer than 2 index points
currentDrawdownPercent  drawdown on the last day of the period
peakDate, troughDate    UTC dates bounding maxDrawdownPercent
```

Field names and `status` follow ADR-002 point 10; unavailable values are
`null`, never `0`.

Errors: as performance. The risk endpoint returns no composite
`riskLevel` or `concentration` score: classification belongs to the Pulse
(ADR-004 point 11, §21), so a second scale is not added.

---

# 21. Portfolio Pulse API

**Status:** `Implemented` inside the overview (§11, FR-007); standalone `GET /api/v1/portfolios/:portfolioId/pulse` `Deferred`; portfolio-series inputs and volatility thresholds `Planned (B1)` (ADR-004 point 11; `16-analytics-spec.md` §15)

The Pulse is returned as `pulse` in `GET /api/v1/portfolios/:portfolioId/overview`.
There is no standalone endpoint. Shape:

```json
{
  "performance":   { "classification": "POSITIVE", "value": 7.2, "explanation": "..." },
  "concentration": { "classification": "MODERATE", "value": 41.0, "explanation": "..." },
  "volatility":    { "classification": "UNKNOWN", "value": null, "explanation": "..." },
  "drawdown":      { "classification": "LOW", "value": -4.1, "explanation": "..." }
}
```

Every dimension carries its value and explanation, so the Pulse stays
explainable. `Implemented`: volatility and drawdown come from the largest
position's candles, and the volatility thresholds are code placeholders.
`Planned (B1)`: both come from the portfolio series over a trailing `1Y`
window, volatility `HIGH` above 60 and `MODERATE` above 20. Exposure, an
`overall` classification and a separate `explanations` list are `Deferred`.

---

# 22. Attribution API

**Status:** current-state `Implemented` (FR-030); range attribution `Planned (B1)` (FR-030, FR-031; ADR-004 point 10; `16-analytics-spec.md` §14)

```text
GET /api/v1/portfolios/:portfolioId/analytics/attribution
```

`Implemented`: no query parameters. Each position's contribution to the
portfolio's unrealized P/L. Response (200):

```json
{
  "data": {
    "totalUnrealizedPnL": { "amount": "120.00", "currency": "USD" },
    "items": [
      {
        "assetId": "asset_001",
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "contribution": { "amount": "90.00", "currency": "USD" },
        "percentageOfTotal": 75
      }
    ]
  }
}
```

`percentageOfTotal` is `0` when the total is `0`. Errors: 404 `NOT_FOUND`.

`Planned (B1)`: `period` or `from` / `to` as in §20, with `asOf` and
`effectiveFrom`, and `groupBy` = `asset` | `assetType`. Each group reports
its contribution in `Money` only, with no percentage; contributions sum
exactly to the period P/L. Sector and the FR-031 factor breakdown are
`Deferred`. Errors: 400 `VALIDATION_ERROR` when `from > to`.

---

# 23. Decision API

**Status:** read `Implemented` (FR-032, FR-033); create, update and close `Deferred`

All endpoints require a Bearer token; a portfolio or decision of another
user returns 404 `NOT_FOUND`. Prices are `Money`.

| Endpoint | Status |
| --- | --- |
| `GET /api/v1/portfolios/:portfolioId/decisions` | `Implemented` |
| `GET /api/v1/portfolios/:portfolioId/decisions/:decisionId` | `Implemented` |
| `POST /api/v1/portfolios/:portfolioId/decisions` | `Deferred` |
| `PATCH /api/v1/portfolios/:portfolioId/decisions/:decisionId` | `Deferred` |
| `POST /api/v1/portfolios/:portfolioId/decisions/:decisionId/close` | `Deferred` |

## List Decisions

**Status:** `Implemented` (FR-032)

```text
GET /api/v1/portfolios/:portfolioId/decisions
```

Query (all optional): `assetId`, `direction` (a `DecisionDirection`
value), `dateFrom`, `dateTo` (dates). Returns 200 `{ "data": [decision] }`,
not paginated, with no `meta`. Errors: 400 `VALIDATION_ERROR`; 404
`NOT_FOUND`. `outcome`, `page` and `pageSize` are `Deferred`: a portfolio
holds few decisions and `outcome` is free-form.

---

## Get Decision

**Status:** `Implemented` (FR-033)

```text
GET /api/v1/portfolios/:portfolioId/decisions/:decisionId
```

Returns 200 `{ "data": decision }`. Errors: 404 `NOT_FOUND` (missing
decision, decision of another portfolio, or portfolio of another user).

---

## Create, Update and Close Decision

**Status:** `Deferred`

```text
POST  /api/v1/portfolios/:portfolioId/decisions
PATCH /api/v1/portfolios/:portfolioId/decisions/:decisionId
POST  /api/v1/portfolios/:portfolioId/decisions/:decisionId/close
```

No FR asks for them (FR-032 to FR-034 are read and replay). Writing
decisions needs decision events created atomically with the decision
(FR-074) and a link to transactions that does not exist. Decisions come
from seed and demo data. Expected vs actual (FR-035) is also `Deferred`.

---

# 24. Decision Replay API

**Status:** `Implemented` (FR-034); event payload prices as decimal strings `Planned (B0)` (ADR-002 point 9)

## Get Replay Timeline

```text
GET /api/v1/decisions/:decisionId/replay
```

Response (200):

```json
{
  "data": {
    "decision": {},
    "events": [],
    "currency": "USD",
    "initialState": {}
  }
}
```

`events` are in chronological order. `currency` is the asset's currency;
event payload prices are plain numbers in it today (decimal strings
`Planned (B0)`). `initialState` is the projection before the first event
(`currentIndex = -1`); the client advances by folding events with the same
pure `projectDecisionReplay` from `@trading/domain` that the server uses.

Ownership is resolved decision → portfolio → user. Errors: 404 `NOT_FOUND`
(missing decision or another user's); 500 `INTERNAL_ERROR` if the
decision's asset is missing (data integrity).

---

# 25. Scenario API

**Status:** `Implemented`; archived-portfolio guard `Planned (B0)` (ADR-010 point 5); role checks `Planned (B2)` (ADR-005)

All endpoints require a Bearer token (§9). The portfolio must be the
caller's and the scenario must belong to it; otherwise 404 `NOT_FOUND`.
Payloads are serialized entities today; response schemas and presenters are
`Planned (B0)` (ADR-002). `Planned (B2)` (ADR-005 point 1): `VIEWER` reads
only; writes need `TRADER` or `ADMIN`.

| Endpoint | Status |
| --- | --- |
| `GET /api/v1/portfolios/:portfolioId/scenarios` | `Implemented` |
| `GET /api/v1/portfolios/:portfolioId/scenarios/:scenarioId` | `Implemented` |
| `POST /api/v1/portfolios/:portfolioId/scenarios` | `Implemented`; 409 on archived portfolio `Planned (B0)` |
| `PATCH /api/v1/portfolios/:portfolioId/scenarios/:scenarioId` | `Implemented`; 409 on archived portfolio `Planned (B0)` |
| `POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/archive` | `Implemented` |
| `DELETE /api/v1/portfolios/:portfolioId/scenarios/:scenarioId` | `Implemented`; 409 on archived portfolio `Planned (B0)` |
| `POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/calculate` | `Implemented` |
| `POST /api/v1/portfolios/:portfolioId/scenarios/compare` | `Implemented` |

Duplicate scenario (FR-041) is `Deferred`.

## List Scenarios

**Status:** `Implemented`

```text
GET /api/v1/portfolios/:portfolioId/scenarios
```

Optional query `status` (`DRAFT`, `SAVED`, `ARCHIVED`). Returns 200
`{ "data": [scenario] }`, each with its `changes`, newest first. Not
paginated. Errors: 400 `VALIDATION_ERROR` (invalid `status`); 404
`NOT_FOUND`.

`GET .../scenarios/:scenarioId` returns 200 `{ "data": scenario }`. Errors:
404 `NOT_FOUND`.

---

## Create Scenario

**Status:** `Implemented` (FR-037)

```text
POST /api/v1/portfolios/:portfolioId/scenarios
```

Request (`description` and `changes` optional; `changes` defaults to none):

```json
{
  "name": "Increase technology exposure",
  "description": "Evaluate higher technology allocation.",
  "changes": [{ "assetId": "asset_001", "percentChange": 10 }]
}
```

A change is a percentage change to the asset's price: never below -100%,
one entry per asset. The portfolio does not have to hold the asset.
Converting `percentChange` to `Decimal` before money arithmetic is
`Planned (B0)` (ADR-002 point 9).

Returns 201 `{ "data": scenario }` with `status = DRAFT`.

Errors: 400 `VALIDATION_ERROR` (blank `name`, invalid or repeated changes;
unknown assets are listed together, one `UNKNOWN_ASSET` detail each); 404
`NOT_FOUND`.

---

## Calculate Scenario

**Status:** `Implemented` (FR-038); allocation, risk and exposure `Deferred`

```text
POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/calculate
```

Response (200):

```json
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

Stateless: it applies the stored `changes` to the portfolio's current
positions and writes nothing, so the baseline never changes (FR-036,
`05-data-model.md` §16). `baseline` and `result` hold `totalValue`,
`investedValue`, `unrealizedPnL` and `unrealizedPnLPercent`; `difference`
holds `totalValue` and `unrealizedPnL`. `unmatchedAssetIds` lists changed
assets the portfolio no longer holds, which are ignored. Any status,
`ARCHIVED` included, can be calculated. Errors: 404 `NOT_FOUND`.

---

## Update Scenario

**Status:** `Implemented` (FR-037, FR-039, FR-040)

```text
PATCH /api/v1/portfolios/:portfolioId/scenarios/:scenarioId
```

Request: any of `name`, `description`, `status` (`DRAFT` or `SAVED`),
`changes`; at least one is required. `changes` replaces the whole list, so
`changes: []` is reset (FR-039) and `status: "SAVED"` is save (FR-040). A
single write: a partly invalid request changes nothing. Returns 200
`{ "data": scenario }`.

Errors: 400 `VALIDATION_ERROR` (empty body, invalid changes, unknown
assets); 404 `NOT_FOUND`; 409 `CONFLICT` when the scenario is `ARCHIVED`.

---

## Archive Scenario

**Status:** `Implemented`

```text
POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/archive
```

Idempotent: always 200 `{ "data": scenario, "meta": { "alreadyArchived": false } }`,
`meta.alreadyArchived` telling whether this call changed anything. An
archived scenario is read-only; there is no unarchive. Errors: 404
`NOT_FOUND`.

---

## Delete Scenario

**Status:** `Implemented` (FR-043)

```text
DELETE /api/v1/portfolios/:portfolioId/scenarios/:scenarioId
```

Returns 204 for any status. Errors: 404 `NOT_FOUND` (including a repeated
delete). `Planned (B0)`: 409 `CONFLICT` when the portfolio is archived
(ADR-010 point 5).

---

## Compare Scenarios

**Status:** `Implemented` (FR-042)

```text
POST /api/v1/portfolios/:portfolioId/scenarios/compare
```

Request: `{ "scenarioIds": [...] }`, 1 to 5 distinct ids of the portfolio.
Read-only: returns 200 and writes nothing.

Response: `baseline` (`metrics`, plus one asset row with `value` and
`allocationPercent`, largest first) and `scenarios` in request order, each
with `scenarioId`, `name`, `status`, `metrics`, `difference`
(`totalValue`, `totalValuePercent` (`null` when the baseline is zero),
`unrealizedPnL`), `unmatchedAssetIds` and `assets` rows (`value`,
`valueDifference`, `allocationPercent`, `allocationShift` in percentage
points), ordered by the size of the difference. Asset rows carry `symbol`
and `name`. Allocation is per asset only. Computed by the domain function
`compareScenarioImpacts`, shared with the demo.

Errors: 400 `VALIDATION_ERROR` (empty, more than 5 or repeated ids); 404
`NOT_FOUND` when any id is missing or foreign (no column is dropped
silently).

---

# 26. Watchlist API

**Status:** `Implemented`; role checks `Planned (B2)` (ADR-005)

All endpoints require a Bearer token (§9) and act on the caller's watchlist.
Uniqueness is per user. `Planned (B2)`: `VIEWER` cannot add or remove.

| Endpoint | Status |
| --- | --- |
| `GET /api/v1/watchlist` | `Implemented` |
| `POST /api/v1/watchlist` | `Implemented` |
| `DELETE /api/v1/watchlist/:assetId` | `Implemented` |

## Get Watchlist

**Status:** `Implemented`

```text
GET /api/v1/watchlist
```

Returns 200 `{ "data": [watchlistItem] }`. No parameters, no pagination.

---

## Add Asset

**Status:** `Implemented`

```text
POST /api/v1/watchlist
```

Request:

```json
{
  "assetId": "asset_001"
}
```

Returns 201 `{ "data": watchlistItem }`.

Errors: 400 `VALIDATION_ERROR` (missing `assetId`, or the asset is already
on the watchlist: duplicates are 400, not 409); 404 `NOT_FOUND` (unknown
asset).

---

## Remove Asset

**Status:** `Implemented`

```text
DELETE /api/v1/watchlist/:assetId
```

Returns 204. Errors: 404 `NOT_FOUND` when the asset is not on the caller's
watchlist (including a repeated removal).

---

# 27. Alerts API

**Status:** `Implemented` (configuration, FR-053); evaluation `Planned (B5)` (ADR-007 point 9); archived-portfolio guard `Planned (B0)` (ADR-010 point 5); role checks `Planned (B2)` (ADR-005)

All endpoints require a Bearer token (§9) and are scoped to the caller:
another user's alert is 404 `NOT_FOUND`. Alerts are managed in the Alerts
tab under Markets (ADR-010 point 9). `Planned (B2)`: `VIEWER` reads only.

| Endpoint | Status |
| --- | --- |
| `GET /api/v1/alerts` | `Implemented` |
| `GET /api/v1/alerts/:alertId` | `Implemented` |
| `POST /api/v1/alerts` | `Implemented`; 409 on archived portfolio `Planned (B0)` |
| `PATCH /api/v1/alerts/:alertId` | `Implemented`; 409 on archived portfolio `Planned (B0)` |
| `DELETE /api/v1/alerts/:alertId` | `Implemented` |

Nothing evaluates alerts yet. `Planned (B5)` (ADR-007 point 9): the server
evaluates alerts on every tick; an alert fires when its condition changes
from false to true and re-arms when it becomes false. Each trigger creates
a `WARNING` notification (§28) and emits `ALERT_TRIGGERED` and
`NOTIFICATION_CREATED`. `armed` and `lastTriggeredAt` are persisted with
the notification (ADR-007 Deferred detail).

## List Alerts

**Status:** `Implemented`

```text
GET /api/v1/alerts
```

Returns 200 `{ "data": [alert] }`. No parameters, no pagination.

`GET /api/v1/alerts/:alertId` returns 200 `{ "data": alert }`. Errors: 404
`NOT_FOUND`.

---

## Create Alert

**Status:** `Implemented` (FR-053)

```text
POST /api/v1/alerts
```

Request (`assetId`, `portfolioId` and `enabled` optional, but at least one
of `assetId` or `portfolioId` is required):

```json
{
  "assetId": "asset_001",
  "type": "PRICE",
  "condition": "ABOVE",
  "threshold": 200,
  "enabled": true
}
```

`type` is `PRICE`, `PORTFOLIO_CHANGE`, `ALLOCATION` or `VOLATILITY`;
`condition` is a non-empty string. Returns 201 `{ "data": alert }`.

Errors: 400 `VALIDATION_ERROR` (no target, unknown `type`, schema or domain
rules); 404 `NOT_FOUND` (unknown asset, or a portfolio that is not the
caller's).

---

## Update Alert

**Status:** `Implemented` (FR-053)

```text
PATCH /api/v1/alerts/:alertId
```

Request: any of `condition`, `threshold`, `enabled`; at least one is
required. The target (`assetId`, `portfolioId`, `type`) cannot change; a
new target is a new alert. Returns 200 `{ "data": alert }`.

Errors: 400 `VALIDATION_ERROR`; 404 `NOT_FOUND`.

---

## Delete Alert

**Status:** `Implemented`

```text
DELETE /api/v1/alerts/:alertId
```

Returns 204. Errors: 404 `NOT_FOUND`.

---

# 28. Notifications API

**Status:** `Implemented` (FR-051, FR-052); notification creation `Planned (B5)` (ADR-007, ADR-010 point 9)

All endpoints require a Bearer token (§9) and are scoped to the caller:
another user's notification is 404 `NOT_FOUND`. A notification is `unread`
or `read` only; there is no `dismissed` state or dismiss action (ADR-010
point 3).

| Endpoint | Status |
| --- | --- |
| `GET /api/v1/notifications` | `Implemented` |
| `POST /api/v1/notifications/:notificationId/read` | `Implemented` |
| `POST /api/v1/notifications/read-all` | `Implemented` |

There is no `POST /api/v1/notifications`: notifications come from system
events only, and nothing creates them yet. `Planned (B5)` (ADR-010 point
9, ADR-008 point 6): sources are triggered alerts (`WARNING`) and CSV import
jobs reaching `COMPLETED` (`SUCCESS`), `FAILED` or `TIMED_OUT` (`ERROR`);
`CANCELLED` jobs and connection changes create none. Creation emits `NOTIFICATION_CREATED` (§31).

## List Notifications

**Status:** `Implemented` (FR-051)

```text
GET /api/v1/notifications
```

Optional query `unreadOnly` (`true` or `false`). Returns 200
`{ "data": [notification] }`, newest first. Filters by `read` or `type`,
and pagination, are `Deferred`.

Errors: 400 `VALIDATION_ERROR` (invalid `unreadOnly`).

---

## Mark Notification Read

**Status:** `Implemented` (FR-052)

```text
POST /api/v1/notifications/:notificationId/read
```

Sets `readAt` and returns 200 `{ "data": notification }`. Errors: 404
`NOT_FOUND`.

---

## Mark All Read

**Status:** `Implemented` (FR-052)

```text
POST /api/v1/notifications/read-all
```

Marks every unread notification of the caller as read. Returns 204.

---

# 29. User Preferences API

**Status:** `Implemented` (FR-087); `language` limited to `en`/`es` `Planned (B0)` (ADR-010 point 8)

Both endpoints require a Bearer token (§9) and act on the caller's
preferences; there is no user id in the route. Preferences are a per-user
singleton row.

| Endpoint | Status |
| --- | --- |
| `GET /api/v1/preferences` | `Implemented` |
| `PATCH /api/v1/preferences` | `Implemented`; `en`/`es` validation `Planned (B0)` |

## Get Preferences

**Status:** `Implemented` (FR-087)

```text
GET /api/v1/preferences
```

Returns 200 `{ "data": preferences }`, or 200 `{ "data": null }` when the
user has never saved preferences (not 404; a read creates nothing). The
client then applies the application defaults.

---

## Update Preferences

**Status:** `Implemented` (FR-087); `en`/`es` and `theme` validation `Planned (B0)`

```text
PATCH /api/v1/preferences
```

Request: any of `theme`, `language`, `defaultPortfolioId`,
`reducedMotion`, `notificationPreferences`; at least one is required.

```json
{
  "theme": "dark",
  "language": "en",
  "reducedMotion": false
}
```

The first `PATCH` creates the row (atomic upsert); omitted fields take the
column defaults of `05-data-model.md` §23 (`theme = "system"`,
`language = "en"`, `reducedMotion = false`, `notificationPreferences = {}`).
`defaultPortfolioId: null` clears it. Returns 200 `{ "data": preferences }`.

Errors: 400 `VALIDATION_ERROR` (no field, empty `theme` or `language`); 404
`NOT_FOUND` (`defaultPortfolioId` missing or another user's). Today
`theme` and `language` accept any non-empty string. `Planned (B0)` (ADR-010
point 8): `language` other than `en` or `es` is 400 and changes nothing.
`Planned (B0)` (ADR-002 point 10): `theme` other than `light`, `dark` or
`system` is 400 and changes nothing.

---

# 30. Health API

**Status:** `Implemented` (NFR-051)

Health routes sit outside `/api/v1`, need no token and are never
rate-limited. Their bodies do not use the `data` envelope. There is no
"degraded" state in version 1: the only dependency is the database.

| Endpoint | Status |
| --- | --- |
| `GET /health` | `Implemented` |
| `GET /health/ready` | `Implemented` |

## Liveness

**Status:** `Implemented`

```text
GET /health
```

Answers whether the process runs; checks no dependency. Always 200:

```json
{
  "status": "ok",
  "service": "trading-api",
  "timestamp": "..."
}
```

---

## Readiness

**Status:** `Implemented`

```text
GET /health/ready
```

Runs `SELECT 1` against the database. Returns 200 with
`"status": "ok"` and `"checks": { "database": "ok" }`, or 503:

```json
{
  "status": "unavailable",
  "service": "trading-api",
  "timestamp": "...",
  "checks": { "database": "unavailable" }
}
```

The body never exposes connection strings or driver errors; details go to
the server log (`health.database.unavailable`).

---

# 31. Realtime API

**Status:** `Planned (B5)` (ADR-007)

Realtime is separate from the HTTP API. The full protocol lives in
`08-realtime-spec.md`; §31-§38 only summarize it.

- Transport: WebSocket (`ws`) behind a transport port.
- Authentication: the access token goes in the first message, never in the
  URL; a socket not authenticated within 5 seconds is closed.
- Channels: `market:{assetId}`, `portfolio:{portfolioId}`, `notifications`
  and `jobs:{jobId}` (ADR-008), each authorized by permission and ownership.
- Heartbeat: ping/pong every 30 seconds.
- The demo uses an in-process realtime adapter behind the same client port
  (`Planned (FE)`).

---

# 32. Realtime Event Envelope

**Status:** `Planned (B5)` (ADR-007 point 4)

Defined as Zod schemas in `@trading/contracts`; money follows ADR-002.

```json
{
  "id": "...",
  "type": "MARKET_PRICE_UPDATED",
  "channel": "market:...",
  "sequence": 1001,
  "timestamp": "2026-08-29T14:30:00Z",
  "payload": {}
}
```

Event catalog, version 1: `MARKET_PRICE_UPDATED`, `PORTFOLIO_UPDATED`,
`NOTIFICATION_CREATED`, `ALERT_TRIGGERED`, plus the job events of ADR-008.
Payloads are specified in `08-realtime-spec.md`.

---

# 33. Market Price Event

**Status:** `Planned (B5)` (ADR-007 point 6)

`MARKET_PRICE_UPDATED` on `market:{assetId}`. Prices are decimal strings
(ADR-002), not numbers. Payload: `08-realtime-spec.md`.

---

# 34. Portfolio Event

**Status:** `Planned (B5)` (ADR-007 point 6)

`PORTFOLIO_UPDATED` on `portfolio:{portfolioId}`, emitted only when holdings
change (after a transaction commits). It does not carry the full portfolio;
the client refetches through HTTP. `TRANSACTION_CREATED`,
`TRANSACTION_COMPLETED` and `POSITION_UPDATED` are removed.

---

# 35. Job Progress Event

**Status:** `Planned (B5)` (ADR-008 point 11)

`JOB_PROGRESS_UPDATED` and the other job events on `jobs:{jobId}`, for CSV
import jobs. Job states are those of ADR-008 point 3.

---

# 36. Notification Event

**Status:** `Planned (B5)` (ADR-007 point 6)

`NOTIFICATION_CREATED` on `notifications`, scoped to the authenticated user.
The client fetches the notification through §28.

---

# 37. Realtime Connection Events

**Status:** `Planned (B5)` (ADR-007 point 12)

The client port exposes a normalized connection state (connected,
reconnecting, disconnected). These are transport states, not domain
entities. While disconnected, the UI shows a stale-data indicator and
refetches through HTTP until it reconnects. State names are defined in
`08-realtime-spec.md`.

---

# 38. Event Ordering

**Status:** `Planned (B5)` (ADR-007 point 5)

`sequence` is monotonic per channel. The client ignores events where:

```text
incomingSequence <= lastProcessedSequence
```

On a gap, the client resynchronizes through HTTP. There is no server-side
replay buffer in version 1.

---

# 39. Idempotency

**Status:** `Planned (B4)` (ADR-008 point 8)

```text
Idempotency-Key: <unique-key>
```

Supported only on `POST /api/v1/portfolios/:portfolioId/transactions` and on
CSV import creation. Keys are stored per user with a hash of the request and
the resulting response, for 24 hours, in the same unit of work as the
mutation. Same key and request returns the stored response; same key with a
different request returns 409 `CONFLICT`. Deposits and withdrawals do not
exist in version 1 (ADR-003).

---

# 40. Pagination

**Status:** `Implemented` (`apps/api/src/schemas/pagination.schema.ts`)

Paginated lists accept:

```text
page      integer >= 1, default 1
pageSize  integer 1-100, default 20
```

Out-of-range values return 400 `VALIDATION_ERROR`. Responses carry `meta`
(§4):

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
}
```

Only `GET /api/v1/assets` and `GET /api/v1/portfolios/:portfolioId/transactions`
are paginated. Other lists return all items without `meta`; each section
states its own behavior.

---

# 41. Filtering

**Status:** `Implemented` (per endpoint)

Filters are flat, named query parameters validated with Zod, for example
`assetId`, `type`, `direction`, `status`, `dateFrom` and `dateTo`. Each
endpoint section lists the filters it really accepts; unknown filters are
not part of the contract. Complex filter expressions are not supported.

---

# 42. Sorting

**Status:** `Reference` (ADR-010 point 4)

No endpoint accepts a `sort` parameter; server-side sorting is `Deferred`.
Paginated lists keep the API order documented for each endpoint (FR-014).
The client sorts only lists loaded in full (`Planned (FE)`).

---

# 43. Date Handling

**Status:** `Implemented`; contract schemas `Planned (B0)` (ADR-002 point 3)

Timestamps are ISO-8601 strings in UTC:

```text
2026-08-29T14:30:00Z
```

Analytics days are UTC calendar dates (ADR-004). Time zone conversion
belongs to the presentation layer.

---

# 44. Monetary Values

**Status:** `Implemented` (output); response schemas `Planned (B0)` (ADR-002 point 3)

```json
{
  "amount": "12345.67",
  "currency": "USD"
}
```

`amount` is a decimal string, never a JavaScript number; prices and
quantities are decimal strings too. Requests accept a decimal string or a
number today. Display rounding happens only in the client (ADR-010 point 9).

---

# 45. API Security

**Status:** `Implemented`; permission checks in the application layer `Planned (B0)` (ADR-001, ADR-005)

- Bearer authentication on every `/api/v1` route except auth and health (§9).
- Role and ownership authorization on the server; client checks are UX only.
- Zod validation of params, query and body; JSON bodies capped at 100 kB.
- `helmet` headers and CORS restricted to `CORS_ORIGIN`.
- Normalized error bodies that never expose stack traces or driver errors.

---

# 46. Resource Ownership

**Status:** `Implemented`

Every portfolio-scoped resource is resolved through its owner. A resource
of another user returns 404 `NOT_FOUND`, the same as a missing one, so its
existence is never revealed:

```text
authenticatedUser
        ↓
portfolio.userId === authenticatedUser.id
        ↓
resource
```

---

# 47. API Rate Limiting

**Status:** `Implemented` (`apps/api/src/middleware/rate-limit.ts`)

| Limiter | Scope | Limit |
| --- | --- | --- |
| General | all `/api/v1` routes | 300 requests per 15 minutes |
| Login | `POST /api/v1/auth/login` | 5 attempts per 15 minutes |

Exceeding a limit returns 429 `RATE_LIMITED` with the normalized error body. Health
routes are not rate-limited. Realtime inbound limits are `Planned (B5)`
(ADR-007 point 11).

---

# 48. API Timeout Behavior

**Status:** Job timeouts `Planned (B4)` (ADR-008 point 7); no HTTP request timeout in v1 (ADR-002 point 10)

The API sets no request timeout, and none is planned for v1: it runs locally
for one user, and the 15 s client timeout (NFR-017) covers the user
experience. CSV import jobs move to `TIMED_OUT`
when they exceed their type's timeout while `QUEUED` or validating; the
apply stage is exempt.

---

# 49. Mock API Contract

**Status:** `Planned (FE)` (ADR-001, ADR-002)

There is no mock API. The demo runs the real application layer
(`@trading/application`) in the browser through an in-process demo adapter
that implements the same client-side ports as the HTTP adapter and returns
the same DTOs (ADR-002 point 5).

---

# 50. Mock API Behavior

**Status:** `Planned (FE)` (ADR-001); simulated latency `Deferred` (ADR-010 point 6)

The demo adapter executes the same use cases, validation and domain
calculations as the API. Realtime comes from the in-process realtime adapter
(§31) and CSV import from the in-process job runner (ADR-008 point 13).
Simulated latency is decided in a frontend-stage ADR.

---

# 51. Mock API and Real API Parity

**Status:** `Planned (FE)` (ADR-002 point 6)

Both adapters share request, response and error shapes, validation, state
transitions and domain calculations through `@trading/contracts` and
`@trading/application`. Only infrastructure differs.

---

# 52. Demo-Only Endpoints

**Status:** `Deferred` (ADR-010 point 6)

The demo runs in the browser, so it needs no `/demo/*` HTTP endpoints, and
none are part of the production contract. Demo controls are decided in the
frontend-stage ADR.

---

# 53. Demo Reset

**Status:** `Deferred` (ADR-010 point 6)

Decided in the frontend-stage ADR, with the demo data layers.

---

# 54. Demo Simulation Controls

**Status:** `Deferred` for the demo (ADR-010 point 6); real-mode control `Planned (B5)` (ADR-007 point 10)

In real mode, starting, pausing and changing the simulation mode require the
`simulation:control` permission (`ADMIN`, ADR-005). Endpoints, all
`Planned (B5)` (ADR-007 point 15):

| Endpoint | Status |
| --- | --- |
| `POST /api/v1/simulation/start` | `Planned (B5)` |
| `POST /api/v1/simulation/pause` | `Planned (B5)` |
| `PUT /api/v1/simulation/mode` | `Planned (B5)` |

Request for `PUT /api/v1/simulation/mode`: `{ "mode": "<wire id>" }`, one
of `PAUSED`, `NORMAL`, `VOLATILE`, `BULLISH`, `BEARISH`. The lifecycle is
only `RUNNING <-> PAUSED`; there is no stop and no seed reset.

Errors: 400 `VALIDATION_ERROR` for an unknown mode; 403 `FORBIDDEN` without
`simulation:control` (ADR-002 point 10). Success bodies and the `PAUSED`
mode overlap are open details in `08-realtime-spec.md` §40-§41.

---

# 55. Demo Failure Simulation

**Status:** `Deferred` (ADR-010 point 6); CSV import failure injection `Planned (FE)` (ADR-008 point 13)

Scripted failures (API errors, latency, disconnects) wait for the
frontend-stage ADR. The demo CSV import supports injectable failures
(FR-069, FR-071). Simulation never corrupts the seed dataset.

---

# 56. API Contract Testing

**Status:** `Planned (B0)` (ADR-002 point 6)

Responses are validated against their `@trading/contracts` schemas in the
API integration tests and in the demo adapter during development. They are
not validated at runtime in production.

---

# 57. API Documentation

**Status:** `Planned (B6)` (ADR-002 point 7)

OpenAPI is generated from the Zod schemas with the `toJSONSchema` function
of Zod v4. There is no hand-maintained API document; this file stays the
design spec.

---

# 58. API Evolution

**Status:** `Reference` (ADR-002 point 8)

All routes stay under `/api/v1`. Within a version only additive changes are
allowed; a breaking change requires a new version.

---

# 59. API Quality Gates

**Status:** CI `Planned (B0)` (ADR-006 point 10)

One GitHub Actions workflow on pushes and pull requests to `develop` and
`main`: install with the lockfile, typecheck, lint, and the domain, database
and API test suites. The contract is acceptable when every endpoint states
its status, errors are normalized, ownership is enforced, and money and
timestamps follow ADR-002.

---

# 60. Final API Principle

**Status:** `Reference`

The API represents application capabilities, not database tables. The
question is "what operation does the product need?", not "how do we expose
this table?":

```text
Create Transaction
Calculate Scenario
Replay Decision
Get Portfolio Overview
Analyze Performance
Track Market Updates
```

---

# 61. Contract Strategy Summary

**Status:** `Reference` (ADR-001, ADR-002)

```text
                     Web app
                        │
                Client-side ports
                        │
              ┌─────────┴─────────┐
              │                   │
        Demo adapter         HTTP adapter
       (in process)               │
              │               HTTP API
              │                   │
              └────────┬──────────┘
                       ↓
     @trading/application + @trading/contracts
                       ↓
              Same domain behavior
```

The public demo is a real implementation of the product, not a static
prototype.
