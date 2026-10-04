# SDD 07 — API Specification

**Project:** Trading Analytics Platform  
**Status:** Draft  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`, `05-data-model.md`, `06-architecture.md`

---

# 1. Purpose

This document defines the API contract for Trading Analytics Platform.

The API must support:

- authentication;
- portfolios;
- positions;
- transactions;
- assets;
- market data;
- analytics;
- decisions;
- decision replay;
- scenarios;
- watchlists;
- alerts;
- notifications;
- background operations.

The API contract must be implementation-independent.

The public demo will implement the same contracts through mock adapters.

---

# 2. API Principles

The API follows these principles:

1. Resource-oriented HTTP APIs for standard operations.
2. Explicit DTOs rather than exposing database models.
3. Consistent response structures.
4. Consistent error structures.
5. Explicit validation.
6. Pagination for potentially large collections.
7. Filtering and sorting where required.
8. Idempotency for operations where duplicate execution is dangerous.
9. Versionable contracts.
10. Realtime events are separate from standard HTTP responses.

---

# 3. API Versioning

Initial version:

```text
/api/v1
```

All production endpoints should be versioned.

Example:

```text
GET /api/v1/portfolios
```

The mock API should expose the same logical version.

---

# 4. Base Response Model

Successful responses should use a consistent structure where appropriate.

Example:

```text
{
  "data": {},
  "meta": {}
}
```

For collections:

```text
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

Not every endpoint requires `meta`.

---

# 5. Error Response

All application errors should use a normalized structure.

```text
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [],
    "requestId": "..."
  }
}
```

---

# 6. Error Codes

Initial error categories:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
TIMEOUT
DEPENDENCY_ERROR
INTERNAL_ERROR
```

Feature-specific error codes may be added when required.

---

# 7. Validation Error

Validation errors should identify the affected fields.

Example:

```text
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid transaction.",
    "details": [
      {
        "field": "quantity",
        "code": "MIN_VALUE",
        "message": "Quantity must be greater than zero."
      }
    ]
  }
}
```

---

# 8. Request Correlation

Every API request should receive a request identifier.

Example:

```text
X-Request-ID
```

The identifier should appear in logs and relevant error responses.

---

# 9. Authentication

## Login

```text
POST /api/v1/auth/login
```

Request:

```text
{
  "email": "user@example.com",
  "password": "..."
}
```

Response:

```text
{
  "data": {
    "user": {},
    "session": {}
  }
}
```

---

## Current User

```text
GET /api/v1/auth/me
```

Returns the authenticated user.

---

## Logout

```text
POST /api/v1/auth/logout
```

---

# 10. Portfolio API

## List Portfolios

```text
GET /api/v1/portfolios
```

Optional parameters:

```text
status
page
pageSize
sort
```

---

## Get Portfolio

```text
GET /api/v1/portfolios/:portfolioId
```

---

## Create Portfolio

```text
POST /api/v1/portfolios
```

Request:

```text
{
  "name": "Growth Portfolio",
  "description": "Long-term growth strategy.",
  "baseCurrency": "USD"
}
```

Response:

```text
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

---

## Update Portfolio

```text
PATCH /api/v1/portfolios/:portfolioId
```

---

## Archive Portfolio

```text
POST /api/v1/portfolios/:portfolioId/archive
```

Archiving is preferred over destructive deletion where historical integrity matters.

---

# 11. Portfolio Overview

```text
GET /api/v1/portfolios/:portfolioId/overview
```

Returns a purpose-specific representation containing:

```text
portfolio
summary
positions
performance
allocation
recentTransactions
pulse
```

This endpoint exists to avoid requiring the dashboard to orchestrate many unrelated requests.

---

# 12. Position API

## List Positions

```text
GET /api/v1/portfolios/:portfolioId/positions
```

Optional parameters:

```text
assetType
sort
direction
page
pageSize
```

---

## Get Position

```text
GET /api/v1/portfolios/:portfolioId/positions/:positionId
```

Response should include current derived metrics where useful.

Example:

```text
{
  "data": {
    "position": {},
    "metrics": {
      "marketValue": 12000,
      "costBasis": 10000,
      "unrealizedPnL": 2000,
      "unrealizedPnLPercent": 20,
      "allocation": 18.4
    }
  }
}
```

---

# 13. Transaction API

## List Transactions

```text
GET /api/v1/portfolios/:portfolioId/transactions
```

Filters:

```text
assetId
type
dateFrom
dateTo
page
pageSize
sort
```

---

## Get Transaction

```text
GET /api/v1/portfolios/:portfolioId/transactions/:transactionId
```

---

## Create Transaction

```text
POST /api/v1/portfolios/:portfolioId/transactions
```

Request:

```text
{
  "assetId": "asset_001",
  "type": "BUY",
  "quantity": 10,
  "price": 150,
  "fees": 2.5,
  "currency": "USD",
  "executedAt": "2026-08-29T14:30:00Z"
}
```

---

# 14. Transaction Processing

Transaction creation may be asynchronous.

Response:

```text
{
  "data": {
    "transaction": {},
    "processing": {
      "status": "PROCESSING",
      "jobId": "job_001"
    }
  }
}
```

The client should not assume immediate completion if the operation is configured as asynchronous.

---

# 15. Transaction Job Status

```text
GET /api/v1/jobs/:jobId
```

Response:

```text
{
  "data": {
    "id": "job_001",
    "status": "PROCESSING",
    "progress": 60,
    "message": "Updating portfolio state."
  }
}
```

Possible statuses:

```text
QUEUED
PROCESSING
COMPLETED
FAILED
CANCELLED
```

---

# 16. Retry Failed Job

```text
POST /api/v1/jobs/:jobId/retry
```

Only retryable jobs may be retried.

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
