# Trading Analytics Platform

## SDD — 07. API Specification

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

```text id="4f0w8v"
{
  "data": {},
  "meta": {}
}
```

For collections:

```text id="y1n8m3"
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

```text id="3s7d2k"
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

```text id="5m3x8q"
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

```text id="z7q1p4"
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

```text id="m4x7d2"
X-Request-ID
```

The identifier should appear in logs and relevant error responses.

---

# 9. Authentication

## Login

```text id="x8c1n7"
POST /api/v1/auth/login
```

Request:

```text id="k3m9p2"
{
  "email": "user@example.com",
  "password": "..."
}
```

Response:

```text id="p2r8v5"
{
  "data": {
    "user": {},
    "session": {}
  }
}
```

---

## Current User

```text id="d4f7q9"
GET /api/v1/auth/me
```

Returns the authenticated user.

---

## Logout

```text id="r5w2m8"
POST /api/v1/auth/logout
```

---

# 10. Portfolio API

## List Portfolios

```text id="k8d4s1"
GET /api/v1/portfolios
```

Optional parameters:

```text id="v2m9x5"
status
page
pageSize
sort
```

---

## Get Portfolio

```text id="c6n1r8"
GET /api/v1/portfolios/:portfolioId
```

---

## Create Portfolio

```text id="h7p3w2"
POST /api/v1/portfolios
```

Request:

```text id="q9x4m1"
{
  "name": "Growth Portfolio",
  "description": "Long-term growth strategy.",
  "baseCurrency": "USD"
}
```

Response:

```text id="z5v8n3"
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

```text id="b3k7y9"
PATCH /api/v1/portfolios/:portfolioId
```

---

## Archive Portfolio

```text id="n8q2c5"
POST /api/v1/portfolios/:portfolioId/archive
```

Archiving is preferred over destructive deletion where historical integrity matters.

---

# 11. Portfolio Overview

```text id="p5d7w1"
GET /api/v1/portfolios/:portfolioId/overview
```

Returns a purpose-specific representation containing:

```text id="h4m9x2"
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

```text id="v7c2n5"
GET /api/v1/portfolios/:portfolioId/positions
```

Optional parameters:

```text id="q1x8m4"
assetType
sort
direction
page
pageSize
```

---

## Get Position

```text id="m5r8d3"
GET /api/v1/portfolios/:portfolioId/positions/:positionId
```

Response should include current derived metrics where useful.

Example:

```text id="x2v7p9"
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

```text id="d9m4k7"
GET /api/v1/portfolios/:portfolioId/transactions
```

Filters:

```text id="p8x2n6"
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

```text id="f3w8q1"
GET /api/v1/portfolios/:portfolioId/transactions/:transactionId
```

---

## Create Transaction

```text id="c7v2m9"
POST /api/v1/portfolios/:portfolioId/transactions
```

Request:

```text id="x4n8p2"
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

```text id="m7q5x3"
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

```text id="v2k9d5"
GET /api/v1/jobs/:jobId
```

Response:

```text id="p4m7x1"
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

```text id="w6n3q8"
QUEUED
PROCESSING
COMPLETED
FAILED
CANCELLED
```

---

# 16. Retry Failed Job

```text id="x8r2m4"
POST /api/v1/jobs/:jobId/retry
```

Only retryable jobs may be retried.

---

# 17. Asset API

## List Assets

```text id="k3p7v1"
GET /api/v1/assets
```

Filters:

```text id="m8q2x5"
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

```text id="d5n9w2"
GET /api/v1/assets/:assetId
```

---

## Asset Price

```text id="r7x4c8"
GET /api/v1/assets/:assetId/price
```

Response:

```text id="p1m6v9"
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

```text id="q4x7n1"
GET /api/v1/assets/:assetId/history
```

Parameters:

```text id="m8d2p5"
from
to
interval
```

Example intervals:

```text id="v1k9r3"
1m
5m
15m
1h
1d
```

---

# 19. Market Data Batch Endpoint

For dashboards displaying multiple assets:

```text id="w5c8m2"
GET /api/v1/market/prices
```

Parameters:

```text id="p7x1d4"
assetIds
```

This avoids excessive individual requests.

---

# 20. Analytics API

## Portfolio Performance

```text id="r3m8q5"
GET /api/v1/portfolios/:portfolioId/analytics/performance
```

Optional:

```text id="v6n2x9"
from
to
interval
```

---

## Allocation

```text id="k7p4d1"
GET /api/v1/portfolios/:portfolioId/analytics/allocation
```

Optional grouping:

```text id="m2x8q5"
asset
assetType
currency
sector
```

---

## Risk

```text id="c9v3n7"
GET /api/v1/portfolios/:portfolioId/analytics/risk
```

Potential response:

```text id="p5x1m8"
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

```text id="d8q4v2"
GET /api/v1/portfolios/:portfolioId/pulse
```

Response:

```text id="m7x2p9"
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

```text id="n5r8c2"
GET /api/v1/portfolios/:portfolioId/analytics/attribution
```

Optional parameters:

```text id="x7m3q1"
from
to
groupBy
```

Possible grouping:

```text id="p2d9v4"
asset
assetType
sector
```

---

# 23. Decision API

## List Decisions

```text id="c8m4x7"
GET /api/v1/portfolios/:portfolioId/decisions
```

Filters:

```text id="v1p6n9"
assetId
direction
outcome
dateFrom
dateTo
page
pageSize
```

---

## Get Decision

```text id="q7d2m5"
GET /api/v1/portfolios/:portfolioId/decisions/:decisionId
```

---

## Create Decision

```text id="m9x4p1"
POST /api/v1/portfolios/:portfolioId/decisions
```

Request:

```text id="k5v8d3"
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

```text id="p3x7m2"
PATCH /api/v1/portfolios/:portfolioId/decisions/:decisionId
```

---

## Close Decision

```text id="v8q1d5"
POST /api/v1/portfolios/:portfolioId/decisions/:decisionId/close
```

---

# 24. Decision Replay API

## Get Replay Timeline

```text id="m4n9x2"
GET /api/v1/decisions/:decisionId/replay
```

Response:

```text id="d7p3v8"
{
  "data": {
    "decision": {},
    "events": [],
    "initialState": {}
  }
}
```

The client controls playback.

---

# 25. Scenario API

## List Scenarios

```text id="x5q8m1"
GET /api/v1/portfolios/:portfolioId/scenarios
```

---

## Create Scenario

```text id="k9d2p4"
POST /api/v1/portfolios/:portfolioId/scenarios
```

Request:

```text id="v3m7x1"
{
  "name": "Increase technology exposure",
  "description": "Evaluate higher technology allocation."
}
```

---

## Calculate Scenario

```text id="p8n4q6"
POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/calculate
```

Response:

```text id="m2x7d9"
{
  "data": {
    "scenarioId": "...",
    "baseline": {},
    "result": {}
  }
}
```

---

## Update Scenario

```text id="c5v1q8"
PATCH /api/v1/portfolios/:portfolioId/scenarios/:scenarioId
```

---

## Archive Scenario

```text id="r7m4x2"
POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/archive
```

---

# 26. Watchlist API

## Get Watchlist

```text id="d8p2n5"
GET /api/v1/watchlist
```

---

## Add Asset

```text id="m6x9q3"
POST /api/v1/watchlist
```

Request:

```text id="v1c7p4"
{
  "assetId": "asset_001"
}
```

---

## Remove Asset

```text id="k4n8m2"
DELETE /api/v1/watchlist/:assetId
```

Duplicate additions should return a conflict or equivalent idempotent response.

---

# 27. Alerts API

## List Alerts

```text id="p9x3d6"
GET /api/v1/alerts
```

---

## Create Alert

```text id="m5q7v1"
POST /api/v1/alerts
```

Request:

```text id="x8d2n4"
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

```text id="c3v9m7"
PATCH /api/v1/alerts/:alertId
```

---

## Delete Alert

```text id="r6p1x8"
DELETE /api/v1/alerts/:alertId
```

---

# 28. Notifications API

## List Notifications

```text id="m7q2d4"
GET /api/v1/notifications
```

Parameters:

```text id="v8x5p1"
read
type
page
pageSize
```

---

## Mark Notification Read

```text id="c9n3m7"
POST /api/v1/notifications/:notificationId/read
```

---

## Mark All Read

```text id="p4x8d2"
POST /api/v1/notifications/read-all
```

---

# 29. User Preferences API

## Get Preferences

```text id="m2v7q5"
GET /api/v1/preferences
```

---

## Update Preferences

```text id="d8x1n4"
PATCH /api/v1/preferences
```

Example:

```text id="k5p9m3"
{
  "theme": "dark",
  "language": "en",
  "reducedMotion": false
}
```

---

# 30. Health API

```text id="r4x7m2"
GET /api/v1/health
```

Response:

```text id="p8n3q5"
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

```text id="x5m8q1"
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

```text id="d7p2v9"
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

```text id="m8q4x2"
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

```text id="p5x9d1"
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

```text id="v3m7q8"
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

```text id="x8n4p2"
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

```text id="m7q3v9"
incomingSequence <= lastProcessedSequence
```

when sequence ordering is available.

This prevents older market events from overwriting newer state.

---

# 39. Idempotency

Mutations with potentially duplicate execution should support idempotency.

Example:

```text id="d2p8x4"
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

```text id="v6m1q9"
page
pageSize
```

Default:

```text id="k3x7p2"
page = 1
pageSize = 20
```

Maximum page size should be bounded.

---

# 41. Filtering

Filtering parameters should use predictable naming.

Examples:

```text id="n8q4m1"
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

```text id="p7d2x5"
sort=createdAt
sort=-createdAt
```

Multiple sort fields may be supported later.

---

# 43. Date Handling

API timestamps should use ISO 8601.

Example:

```text id="m4v8q2"
2026-08-29T14:30:00Z
```

Timezone conversion belongs to the presentation layer unless business rules explicitly require timezone-aware calculations.

---

# 44. Monetary Values

Monetary API fields must have predictable precision.

The API should avoid ambiguous representations.

Possible implementation:

```text id="x7n2p5"
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

```text id="q8m3d1"
GET /api/v1/portfolios/:portfolioId
```

must verify:

```text id="v2p7x5"
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

```text id="m8x2q4"
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

```text id="p4n7x1"
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

```text id="x9m3d7"
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

```text id="v5q8m2"
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

```text id="d2x7p4"
POST /demo/reset
POST /demo/simulation/start
POST /demo/simulation/stop
POST /demo/failures
```

These belong to a separate demo controller.

---

# 53. Demo Reset

Conceptually:

```text id="m9q3v6"
POST /demo/reset
```

Result:

```text id="p5x8d1"
Seed Data
    ↓
Fresh Session
```

The endpoint is unavailable in production mode.

---

# 54. Demo Simulation Controls

Potential operations:

```text id="x4n7m2"
POST /demo/simulation/start
POST /demo/simulation/pause
POST /demo/simulation/resume
POST /demo/simulation/stop
```

The exact controls may be exposed through a developer/demo panel rather than the primary product UI.

---

# 55. Demo Failure Simulation

Potential categories:

```text id="q8d2v5"
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

```text id="m7x4p1"
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

```text id="c5n8q2"
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

```text id="j6p4x8"
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

```text id="w3n8q5"
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
