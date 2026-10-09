# SDD 02 — Functional Requirements

**Project:** Trading Analytics Platform  
**Status:** Reconciled with the ADRs and the code on 2026-10-05 (task T3.1)  
**Version:** 2.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `16-analytics-spec.md`  
**Decisions:** ADR-001 to ADR-009 (`adr/README.md`)

---

# 1. Purpose

**Status:** `Reference`

This document is the functional contract of Trading Analytics Platform. Each
requirement (FR-NNN) states observable behavior, its status, the decisions it
depends on and testable acceptance criteria.

The requirements apply to both runtimes defined by ADR-006 point 1:

- the local full stack (API, PostgreSQL, web app in real mode);
- the public demo: the web app running `@trading/application` in the
  browser on in-memory infrastructure (ADR-001 point 4, ADR-002 point 5).

The demo replaces infrastructure, never a workflow: the same use cases,
validation and permission checks run in both modes. Which parts of the demo
are decided is stated per requirement in §21; demo data layers, reset,
simulated latency and scripted failures other than CSV import are `Deferred`
(`00-overview.md` §6.2-6.3).

Precedence (`README.md`): an ADR overrides this document; this document
overrides the roadmap and the progress log. Code is evidence of what exists.

---

# 2. Requirement Structure

**Status:** `Reference`

Each requirement has:

```text
ID and title           stable; cited by code, tests and other documents
Priority               P0-P3
Status                 legend of docs/README.md, with block or ADR citation
Decisions              ADR points and spec sections it implements
Requirement            the behavior
Acceptance criteria    testable statements (Given/When/Then or equivalent)
```

### Priority

- **P0 — Critical:** Required for the product to function.
- **P1 — Core:** Required for the intended product experience.
- **P2 — Important:** Adds meaningful product capability.
- **P3 — Future:** Not required for the initial implementation.

### Status

`Implemented`, `Planned (B#)`, `Planned (FE)` or `Deferred`, as defined in
`README.md`. A requirement with backend and frontend parts states both, for
example "API `Implemented`; UI `Planned (FE)`". A `Deferred` requirement keeps
its ID because code and documents cite it; its criteria are written when a
new decision schedules it.

### Acceptance criteria conventions

- Every P0 and P1 requirement that is not `Deferred` has acceptance criteria.
  P2 requirements have them where cheap; otherwise they are written when the
  requirement is scheduled.
- A criterion inherits the requirement's status unless it carries its own
  block, for example "(B2)".
- API criteria are verified by integration tests in `apps/api`; domain and
  application criteria by unit tests; UI criteria by frontend tests
  (`10-testing-strategy.md`).
- Common API behavior, referenced instead of repeated:
  - **Errors** use the envelope `{ error: { code, message, requestId, details? } }`
    (ADR-002 point 2). Malformed input is 400 `VALIDATION_ERROR`; domain
    invariant violations are 400 `VALIDATION_ERROR`.
  - **Authentication.** A protected endpoint without a valid access token
    returns 401 `UNAUTHORIZED`.
  - **Ownership.** A resource of another user returns 404 `NOT_FOUND`,
    never 403 (ADR-005 point 12).
  - **Money** is `{ amount: string, currency: string }`; percentages are
    JSON numbers; dates are ISO-8601 UTC (ADR-002 point 3).
- Criteria that touch money, imports, sessions or realtime cover the
  failure-mode checklist of `README.md` (concurrency, crash and restart,
  timeouts and expiry, retries and duplicates, boundary math, partial
  failure) using only behavior an ADR or spec already decides.

---

# 3. Authentication

## FR-001 — User Login

**Priority:** P0  
**Status:** API `Implemented` (`POST /api/v1/auth/login`); login response shape and refresh cookie `Planned (B2)`; UI and demo identity `Planned (FE)`  
**Decisions:** ADR-005 points 4, 8, 10, 11, 12

A user that exists in the seed authenticates with email and password. There
is no self-registration (ADR-005 point 10).

### Acceptance criteria

- Given a seeded user, when valid credentials are posted, then the response
  is 200 with an access token valid for 15 minutes.
- (B2) Given valid credentials, then the body is
  `{ user, session: { accessToken, expiresAt } }` and a refresh cookie is set
  as in FR-083 (ADR-005 points 5 and 8).
- Given an unknown email or a wrong password, then the response is 401
  `UNAUTHORIZED` with the same message in both cases (no account
  enumeration).
- Given a malformed body, then the response is 400 `VALIDATION_ERROR` and no
  credential check runs.
- Given 5 login requests from one client within 15 minutes, when a sixth
  arrives in the same window, then the response is 429 `RATE_LIMITED`
  (ADR-005 point 12).
- No registration endpoint or screen exists.
- (FE) While the request is pending, the submit control is disabled and a
  second submit sends no request; after a failure the form can be submitted
  again without reloading.
- (FE) The access token is held in memory only, never in `localStorage` or
  `sessionStorage` (ADR-005 point 4).
- (FE) The demo offers a demo identity with a role selector (Viewer, Trader,
  Admin) that goes through the same permission checks (ADR-005 point 11).

---

## FR-002 — Session Persistence

**Priority:** P0  
**Status:** `Planned (B2)` (refresh); client flow `Planned (FE)`. Today the session ends when the 15-minute token expires (`Implemented`).  
**Decisions:** ADR-005 points 4, 5, 6, 9

An authenticated session survives page reloads and access-token expiry
through the refresh flow of FR-083.

### Acceptance criteria

- Given a valid refresh cookie, when the application reloads and the
  in-memory access token is lost, then the client obtains a new access token
  through `POST /api/v1/auth/refresh` without showing the login screen.
- Given an expired access token, when an API call returns 401, then the
  client refreshes once and retries the original request once; it does not
  loop.
- Given parallel 401s (several requests or tabs), then the client performs a
  single-flight refresh (ADR-005 Deferred detail, B2).
- Given a missing, revoked or expired refresh token, when refresh is
  attempted, then it returns 401 and the client discards its in-memory state
  and shows the login screen.
- Given no session, when a protected route is opened, then the UI redirects
  to login and the API returns 401 for every protected endpoint.

---

## FR-003 — Logout

**Priority:** P0  
**Status:** `Planned (B2)` (endpoint); UI `Planned (FE)`  
**Decisions:** ADR-005 points 6 and 7

The user terminates the current session.

### Acceptance criteria

- Given a session, when `POST /api/v1/auth/logout` is called with the
  required custom header, then the session's refresh-token family is revoked
  and the refresh cookie is cleared.
- Given a logged-out session, when its refresh token is presented, then
  refresh returns 401.
- An access token issued before logout stays valid until it expires (at most
  15 minutes); this is documented behavior, not a defect (ADR-005 point 6).
- Given a logout request without the custom header, then it is rejected and
  the session is not revoked (ADR-005 point 7).
- (FE) After logout the client discards the access token and all cached
  portfolio data and redirects to login; navigating back shows no protected
  data.
- (FE) In the demo, logout returns to the demo identity selector.

---

# 4. Dashboard

## FR-004 — Display Portfolio Overview

**Priority:** P0  
**Status:** API `Implemented` (`GET /api/v1/portfolios/:portfolioId/overview`); period `performance` field `Planned (B1)`; UI `Planned (FE)`  
**Decisions:** ADR-004 points 5 and 11; ADR-007 point 14; `16-analytics-spec.md` §11-§15

The dashboard shows the selected portfolio: total value, daily change,
performance, allocation, positions and main contributors.

### Acceptance criteria

- Given a portfolio with positions, then the overview returns the portfolio
  summary (total market value, cost basis, unrealized P/L and percent),
  positions with metrics and allocation percent, allocation by asset,
  current-state attribution, recent transactions, `dailyChange` and `pulse`.
- Given an empty portfolio, then the overview is 200 with zeroed totals in
  `baseCurrency`, empty lists and a zeroed, non-null `dailyChange`
  (`16-analytics-spec.md` §11-§12).
- Given positions where no asset has a `MarketPrice`, then `dailyChange` is
  `null`, never a fabricated value; when only some assets lack a price, they
  are listed in `excludedAssetIds`.
- Given another user's portfolio, then 404.
- (B1) The overview adds period `performance` (FR-025); its shape is fixed
  with `07-api-spec.md` §20 (task T4.1).
- (FE) Loading, empty and error states are shown; the error state offers
  retry.

---

## FR-005 — Portfolio Selection

**Priority:** P0  
**Status:** `Planned (FE)`  
**Decisions:** —

The user switches between their portfolios.

### Acceptance criteria

- Given portfolio A is displayed, when B is selected, then every
  portfolio-scoped view (overview, positions, transactions, analytics) shows
  B's data.
- Given a slow response for A arrives after B was selected, then it is
  discarded and A's data is never rendered under B.
- While B's data loads, a loading state is shown instead of A's values.

---

## FR-006 — What Changed

**Priority:** P1  
**Status:** `Planned (B1)` (API); UI `Planned (FE)`. Significant value change, unusual volatility and allocation changes are `Deferred`.  
**Decisions:** ADR-010 point 1; ADR-004 point 10

The dashboard reports what changed in the selected portfolio over the
selected period, derived only from real data.

### Acceptance criteria

- The events cover the same period and boundaries as performance
  (`16-analytics-spec.md` §7-§8).
- The largest contributor and the largest detractor come from range
  attribution. When every contribution is `≥ 0` there is no detractor, and
  when every contribution is `≤ 0` there is no contributor. A tie goes to
  the alphabetically first asset symbol.
- A position is reported as opened when its quantity goes from 0 to above
  0, and as closed when its quantity reaches 0. One that opens and closes in
  the period produces both events, in date order.
- Alerts triggered in the period are listed.
- An empty portfolio, or a period with no events, returns an empty list
  (not an error).

---

## FR-007 — Portfolio Pulse

**Priority:** P1  
**Status:** `Implemented` (`portfolio-pulse.ts`, in the overview); portfolio volatility and drawdown inputs, boundary tests and `GET .../pulse` `Planned (B1)`; exposure and liquidity `Deferred` (`05-data-model.md` §29)  
**Decisions:** ADR-004 point 11; `16-analytics-spec.md` §15

A deterministic, explainable classification of the portfolio state. No
external AI service is used.

### Acceptance criteria

- Each dimension returns a `classification`, the underlying `value` and an
  `explanation`.
- Performance (`unrealizedPnLPercent`): `> 5` `POSITIVE`, `< −5`
  `NEGATIVE`, otherwise `NEUTRAL`; `5` and `−5` are `NEUTRAL`.
- Concentration (largest allocation by asset): `> 50` `HIGH`, `> 25`
  `MODERATE`, otherwise `LOW`; `50` is `MODERATE`, `25` is `LOW`.
- (B1) Volatility uses the portfolio's annualized volatility (FR-029) over a
  trailing `1Y` window ending on the last closed day: `> 60` `HIGH`, `> 20`
  `MODERATE`, otherwise `LOW`; `20` is `LOW`, `60` is `MODERATE`.
- (B1) Drawdown uses the portfolio's maximum drawdown (FR-028) over the same
  window: `< −20` `SEVERE`, `< −10` `MODERATE`, otherwise `LOW`; `−20` is
  `MODERATE`, `−10` is `LOW`.
- (B1) Given fewer than 20 daily returns, volatility is `UNKNOWN`; given
  fewer than 2 index points, drawdown is `UNKNOWN`.
- Given the same inputs, the result is identical.

---

# 5. Portfolio Management

## FR-008 — List Portfolios

**Priority:** P0  
**Status:** API `Implemented` (`GET /api/v1/portfolios`); UI `Planned (FE)`  
**Decisions:** ADR-005 point 12

### Acceptance criteria

- Given an authenticated user, then the list contains only their own
  portfolios, archived ones included with `status = ARCHIVED`.
- Given a user with no portfolios, then 200 with an empty list.
- (FE) Loading, empty and error-with-retry states are shown.

---

## FR-009 — Create Portfolio

**Priority:** P0  
**Status:** API `Implemented` (`POST /api/v1/portfolios`); permission check `Planned (B2)`; UI `Planned (FE)`  
**Decisions:** ADR-004 point 12; ADR-005 point 2

### Acceptance criteria

- Given a non-empty `name` and a 3-letter `baseCurrency`, then 201 with a
  portfolio owned by the caller, `status = ACTIVE`.
- Given an empty name or an invalid currency code, then 400
  `VALIDATION_ERROR` and nothing is created.
- `baseCurrency` cannot be changed after creation (`05-data-model.md` §43).
- (B2) Given a `VIEWER`, then creation is denied by the permission check.
- (FE) Submit is disabled while the request is pending; on success the list
  shows the new portfolio without reload; on failure the entered values
  remain.
- (FE) In the demo the portfolio persists for the session (FR-067).

---

## FR-010 — Edit Portfolio

**Priority:** P1  
**Status:** API `Implemented` (`PATCH /api/v1/portfolios/:portfolioId`); UI `Planned (FE)`  
**Decisions:** ADR-005 point 12

### Acceptance criteria

- Given `name` or `description`, then 200 with the updated portfolio.
- Given neither field, then 400 `VALIDATION_ERROR`.
- Given a `baseCurrency` in the body, then the stored currency does not
  change.
- Given another user's portfolio, then 404 and nothing is written.
- (FE) The form opens with current values; cancel sends no request; on
  failure the previous values stay displayed.

---

## FR-011 — Delete Portfolio

**Priority:** P1  
**Status:** `Implemented` as archive (`POST /api/v1/portfolios/:portfolioId/archive`); read-only archived portfolios `Planned (B0)`; hard deletion and unarchiving `Deferred` (`05-data-model.md` §42); UI `Planned (FE)`  
**Decisions:** ADR-010 point 5; `05-data-model.md` §42-§43

Deleting a portfolio archives it: history is preserved.

### Acceptance criteria

- Given an active portfolio, when archived, then its `status` becomes
  `ARCHIVED` and its transactions, positions and decisions are kept.
- Given an already archived portfolio, when archived again, then the call
  succeeds with `alreadyArchived = true`.
- Given another user's portfolio, then 404.
- (B0) Given an archived portfolio, any mutation scoped to it (creating
  transactions, or creating or changing decisions, scenarios, alerts or CSV
  import jobs)
  returns 409 `CONFLICT` and writes nothing. Reads still succeed.
- (FE) A confirmation is required; cancel sends no request; if the archived
  portfolio was selected, the selection moves to another portfolio or to the
  empty state.

---

# 6. Positions

## FR-012 — Display Positions

**Priority:** P0  
**Status:** API `Implemented` (`GET .../positions`, overview); fees in `averageEntryPrice` `Planned (B1)`; live `currentPrice` `Planned (B5)`; UI `Planned (FE)`  
**Decisions:** ADR-004 point 15; ADR-007 Deferred detail; `16-analytics-spec.md` §12

Each position exposes asset, quantity, average entry price, current price,
market value, unrealized P/L and percent, and allocation.

### Acceptance criteria

- `marketValue = currentPrice × quantity`,
  `unrealizedPnL = marketValue − averageEntryPrice × quantity`.
- Given a `SELL` of the full held quantity, then the position no longer
  appears.
- (B1) Given `BUY 10 @ 10, fees 1`, then `averageEntryPrice = 10.1`; a
  `SELL` leaves it unchanged.
- Given another user's portfolio, then 404.
- (FE) An empty portfolio shows the positions empty state.

---

## FR-013 — Position Detail

**Priority:** P1  
**Status:** API `Implemented` (position by id, transactions filtered by asset, asset history, decisions filtered by asset); composed view `Planned (FE)`  
**Decisions:** ADR-001 point 6

### Acceptance criteria

- Given a position id of another portfolio or user, then 404.
- The detail's transaction history equals the portfolio's transactions
  filtered by the position's `assetId`.
- (FE) Each missing part (no decisions, no history) shows its own empty
  state; returning to the list keeps the previous filters.

---

# 7. Transactions

## FR-014 — List Transactions

**Priority:** P0  
**Status:** API `Implemented` (`GET /api/v1/portfolios/:portfolioId/transactions`, paginated); realized P/L per `SELL` `Planned (B1)`; UI `Planned (FE)`  
**Decisions:** ADR-003 points 1 and 4; ADR-004 point 15

Each transaction shows type, asset, quantity, price, fees, `executedAt` and
status.

### Acceptance criteria

- Results are ordered by `executedAt` descending, then `id` descending.
- The response carries `meta { page, pageSize, total, totalPages }` (FR-056).
- Given another user's portfolio, then 404.
- The creation response returns the resulting position
  (`{ transaction, position }`).
- (B1) Realized P/L of a `SELL` is `quantity × (price − averageEntryPrice) −
  fees`; `BUY 10 @ 10, fees 1` then `SELL 4 @ 11.5, fees 1` realizes `4.6`.

---

## FR-015 — Search Transactions

**Priority:** P1  
**Status:** satisfied by FR-016 and FR-020 (see their statuses); free-text transaction search `Deferred`  
**Decisions:** ADR-010 point 2

The user finds transactions with the FR-016 filters and finds assets with
the FR-020 search. There is no separate search in version 1, so this FR adds
no acceptance criteria of its own.

---

## FR-016 — Filter Transactions

**Priority:** P1  
**Status:** API `Implemented` (`assetId`, `type`, `dateFrom`, `dateTo`; portfolio by path); UI `Planned (FE)`  
**Decisions:** ADR-003 point 1

### Acceptance criteria

- Given several filters, then they combine with AND.
- `meta.total` equals the number of transactions matching the filters.
- Given no match, then 200 with an empty list and `total = 0`.
- Given a `type` other than `BUY` or `SELL`, then 400 `VALIDATION_ERROR`.
- Filtering never changes stored data.
- (FE) Resetting the filters restores the unfiltered first page.

---

## FR-017 — Create Transaction

**Priority:** P0  
**Status:** `Implemented` (synchronous, atomic through `UnitOfWork`); position isolation under concurrency `Planned (B0)`; `Idempotency-Key` `Planned (B4)`; `PORTFOLIO_UPDATED` event `Planned (B5)`; UI `Planned (FE)`  
**Decisions:** ADR-001 Deferred detail; ADR-003 points 1, 2, 6; ADR-007 point 6; ADR-008 points 8 and 12

A `BUY` or `SELL` is validated (FR-018), persisted, and its position is
recalculated in one unit of work. Creation is synchronous; there is no job
for a single transaction (ADR-008 point 12).

### Acceptance criteria

- Given a valid `BUY`, then 201 with the transaction in status `COMPLETED`
  and the upserted position.
- Given a `SELL` of exactly the held quantity, then 201 and the position is
  removed (`position = null`).
- Given a `SELL` larger than the holding, then 400 `VALIDATION_ERROR`
  (`InsufficientPositionQuantityError`) and nothing is written.
- Partial failure: given the position update fails after the transaction
  row is inserted, then the unit rolls back and no row remains in any status.
- Only `COMPLETED` transactions are ever committed.
- (B0) Concurrency: given a holding of 10, when two `SELL 6` requests run
  concurrently, then exactly one succeeds and the other returns 400.
- (B4) Retries: given a repeated request with the same `Idempotency-Key`,
  then no second transaction is created (FR-082).
- (B2) Given a `VIEWER`, then creation is denied.
- (B5) After commit, `PORTFOLIO_UPDATED` is emitted on
  `portfolio:{portfolioId}`.
- (FE) Submit is disabled while pending; on success, dependent views update
  without reload (FR-077).

---

## FR-018 — Transaction Validation

**Priority:** P0  
**Status:** per rule below  
**Decisions:** ADR-003 points 1, 2, 6 and Deferred detail; ADR-004 points 2 and 12; ADR-008 point 10

Every rule applies identically to API requests, CSV import rows (FR-080) and
the demo (ADR-001).

### Acceptance criteria

- `Implemented`: `type` is `BUY` or `SELL`; `quantity > 0`; `price > 0`;
  `fees ≥ 0`; fee currency equals price currency; `executedAt` is not in the
  future. Any violation is 400 `VALIDATION_ERROR` with nothing written.
- `Implemented`: an unknown `assetId` is 404.
- `Implemented`: a `SELL` above the current position is 400.
- (B0) Chronological validation: given `BUY 10` on day 2, when a `SELL 5`
  dated day 1 is submitted, then 400; given a backdated `BUY`, then it is
  accepted; given a backdated `SELL` that would make a later existing `SELL`
  oversell, then 400 (ADR-003 point 6).
- (B0) Transactions with the same `executedAt` are ordered by creation order
  (row order for an import) in every runtime; a `BUY` and a `SELL` sharing a
  timestamp give the same result in the API and the demo.
- (B1) Given an asset whose currency differs from the portfolio's
  `baseCurrency`, then 400 (ADR-004 point 12), never 500.
- (B1) Given a `SELL` with `fees > quantity × price`, then 400; fees equal to
  `quantity × price` are accepted; fees one unit of the last decimal place
  above are rejected (ADR-004 point 2).
- No cash validation exists: there is no cash balance (ADR-003 point 2).

---

# 8. Assets

## FR-019 — List Assets

**Priority:** P0  
**Status:** API `Implemented` (`GET /api/v1/assets`, paginated); UI `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- The list is paginated (FR-056) and filterable by `assetType`
  (`STOCK`, `ETF`, `CRYPTO`, `FOREX`), `exchange`, `currency` and `status`.
- Given an invalid filter value, then 400 `VALIDATION_ERROR`.
- Requires authentication.

---

## FR-020 — Asset Search

**Priority:** P1  
**Status:** `Implemented` (`search` parameter); wildcard escaping `Planned (B7)` (`BACKEND-ROADMAP.md` §4); UI `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Given `search`, then assets whose symbol or name contains it, case
  insensitive, are returned; asset class is searched with the `assetType`
  filter.
- Given `search` empty after trimming or longer than 100 characters, then
  400.
- Given no match, then 200 with an empty list.
- (B7) `%` and `_` in `search` match literally.

---

## FR-021 — Asset Detail

**Priority:** P1  
**Status:** API `Implemented` (detail, current price, history); UI `Planned (FE)`; asset volatility, portfolio exposure and related positions in the detail `Deferred` (no endpoint or decision; defined when scheduled)  
**Decisions:** ADR-007 point 14

### Acceptance criteria

- Given an unknown asset, then 404 on detail, price and history.
- Given an asset without a current price, then the price endpoint returns
  404 and the UI shows "no price" instead of a value.
- History returns daily candles between `from` and `to`.
- `change` and `changePercent` are measured against the last closed daily
  candle (ADR-007 point 14; under continuous ticking `Planned (B5)`).

---

# 9. Watchlist

## FR-022 — Add Asset to Watchlist

**Priority:** P1  
**Status:** API `Implemented` (`POST /api/v1/watchlist`); UI `Planned (FE)`  
**Decisions:** `05-data-model.md` §17

### Acceptance criteria

- Given an existing asset, then 201 and it appears in the user's watchlist.
- Given an asset already in the watchlist, then 400 `VALIDATION_ERROR` and
  no duplicate entry exists.
- Given an unknown asset, then 404.
- (FE) The list updates without reload and a confirmation is shown.

---

## FR-023 — Remove Asset From Watchlist

**Priority:** P1  
**Status:** API `Implemented` (`DELETE /api/v1/watchlist/:assetId`); UI `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Given an asset in the watchlist, then 204 and it is removed.
- Given an asset not in the watchlist, then 404.

---

## FR-024 — Watchlist Price Updates

**Priority:** P1  
**Status:** server events `Planned (B5)`; client `Planned (FE)`  
**Decisions:** ADR-007 points 3, 5, 6, 12, 13

### Acceptance criteria

- Given a watchlist, the client subscribes to `market:{assetId}` for each
  asset; a `MARKET_PRICE_UPDATED` event updates the displayed price without
  reload.
- Given a sequence gap on a channel, then the client resynchronizes through
  HTTP (ADR-007 point 5).
- Given the socket is down, then a stale-data indicator is shown and prices
  are refetched through HTTP periodically until it reconnects (point 12).
- In the demo, events come from `@trading/market-sim` in the browser through
  the same client port (point 13).

---

# 10. Analytics

## FR-025 — Portfolio Performance

**Priority:** P0  
**Status:** `Planned (B1)`; `1D` `Implemented` (`portfolio-daily-change.ts`)  
**Decisions:** ADR-004 points 1-6, 14; `16-analytics-spec.md` §2-§8, §11

The system reports, for a period, the time-weighted return (`twrPercent`)
and the absolute P/L. Periods are `1D`, `1W`, `1M`, `3M`, `6M`, `1Y`, `YTD`,
`ALL` and a custom `from`/`to` range (ADR-004 point 5).

### Acceptance criteria

- `1D` comes from `MarketPrice` (`changeValue`, `changePercent`), not from
  the daily series.
- Presets are counted back from `to` in UTC calendar dates, with
  `from = (to − offset) + 1 day`: given `to = 2026-03-31`, `1W` covers
  25-31 March; `1M` has anchor 2026-02-28 and `from = 2026-03-01`; `3M` and
  `YTD` start on 2026-01-01; given `to = 2028-02-29`, `1Y` starts on
  2027-03-01. `ALL` starts on the first `COMPLETED` transaction day.
- Custom ranges are inclusive UTC dates: `from > to` is 400; `from = to` is a
  valid one-day period.
- `period` and `from`/`to` are mutually exclusive: sending both is 400
  `VALIDATION_ERROR`; with neither, the period is `1M` (ADR-002 point 10).
- The daily return is `r(d) = (V(d) + S(d)) / (V(d−1) + B(d)) − 1` with
  `BUY` fees in `B` and `SELL` fees subtracted in `S`; given `V(d−1) = 100`
  fully sold for `110`, then `r(d) = +10%`.
- A day with a zero denominator has no return, which differs from a zero
  return.
- `TWR = Π (1 + r(d)) − 1` over the same days as P/L; in the worked example
  of `16-analytics-spec.md` §7, `TWR` equals `Decimal(117).div(101).minus(1)`
  exactly and `twrPercent ≈ 15.841584`, unrounded.
- `P/L = V(end) − V(start) − Σ F(d)` as `Money`; buying more is never
  reported as a gain.
- When `TWR` has no value, `twrPercent` is `null`, never `0`.
- Only `COMPLETED` transactions count. Data boundaries (`asOf`,
  `effectiveFrom`, `InsufficientData`) follow FR-085.

---

## FR-026 — Historical Performance

**Priority:** P1  
**Status:** series `Planned (B1)`; charts `Planned (FE)`  
**Decisions:** ADR-004 points 1, 4, 7; `16-analytics-spec.md` §3, §7

The user inspects how performance evolved over a period.

### Acceptance criteria

- The history uses the same periods, days and boundaries as FR-025; its
  final cumulative value equals that period's `twrPercent`.
- Points are UTC closed days up to `asOf`; carried-forward prices are used
  for days without a candle (ADR-004 point 7).
- Ranges that are `InsufficientData` are shown as gaps, never as zero.
- The response shape is fixed with `07-api-spec.md` §20 (task T4.1).

---

## FR-027 — Allocation Analysis

**Priority:** P1  
**Status:** `Implemented` (`GET .../analytics/allocation`, `groupBy` `asset`, `assetType`, `currency`); sector `Deferred` (ADR-004 point 13)  
**Decisions:** ADR-004 points 12 and 13; `16-analytics-spec.md` §13

### Acceptance criteria

- `percentage(group) = marketValue(group) / Σ marketValue × 100`, and `0`
  when the total is `0`; percentages are not rebalanced to sum to 100.
- Given no positions, then an empty group list.
- Given `groupBy=sector` or any other value, then 400 `VALIDATION_ERROR`.
- Under the single-currency rule, `groupBy=currency` yields one group.

---

## FR-028 — Drawdown

**Priority:** P1  
**Status:** `Planned (B1)` (portfolio level); asset level `Implemented` (`drawdown.ts`)  
**Decisions:** ADR-004 point 9; `16-analytics-spec.md` §10

### Acceptance criteria

- Drawdown is computed on the cumulative return index (growth of 1), not on
  raw value; a purchase never produces a drawdown recovery.
- The result reports maximum drawdown with peak and trough dates, and the
  current drawdown.
- Given fewer than 2 index points, then `UNKNOWN`.
- Given two equal peaks, then the first is reported.

---

## FR-029 — Volatility

**Priority:** P1  
**Status:** `Planned (B1)` (portfolio level); asset level `Implemented` (`volatility.ts`, to be changed in B1)  
**Decisions:** ADR-004 point 8; `16-analytics-spec.md` §9

### Acceptance criteria

- Volatility is the sample standard deviation of the daily `TWR` returns,
  annualized with √365, as a percentage.
- Given 19 daily returns, then `UNKNOWN`; given 20, then a value.
- Given 20 returns alternating `+1%` and `−1%`, then volatility is
  `≈ 19.601%`.

---

# 11. Performance Attribution

## FR-030 — Calculate Performance Contribution

**Priority:** P1  
**Status:** current-state attribution `Implemented` (`attribution.ts`, `GET .../analytics/attribution`); range attribution `Planned (B1)`; factor breakdown `Deferred` (ADR-004 point 10)  
**Decisions:** ADR-004 point 10; `16-analytics-spec.md` §14

The user sees how much each asset contributed to the period result, in
money.

### Acceptance criteria

- Current state: each position's contribution is its unrealized P/L, and
  `percentageOfTotal` is `0` when the total is `0`.
- (B1) Range: `contribution(a) = V_a(to) − V_a(from−1) − Σ F_a(d)` over the
  FR-025 days; contributions sum exactly, in `Money`, to the period P/L.
  Given asset A contributing `16` and B `−5`, then P/L is `11`.
- (B1) Range attribution reports money only, with no percentage; `groupBy`
  accepts `asset` and `assetType`; a group is the sum of its assets.
- No Brinson-style or factor decomposition is returned.

---

## FR-031 — Attribution Detail

**Priority:** P1  
**Status:** money contribution per asset `Planned (B1)` (ADR-004 point 10); breakdown by factor (price movement, position size, fees, realized results) `Deferred` — ADR-004 point 10 decides no decomposition  
**Decisions:** ADR-004 points 2, 10, 15

The user inspects one asset's contribution over a period.

### Acceptance criteria

- (B1) For a selected asset, the detail shows the same money contribution
  as FR-030 and the flows that make it up (`B_a`, `S_a` per day).
- Fees and realized results are included through the flows; no separate
  per-factor figures are returned.

---

# 12. Decision Replay

## FR-032 — List Decisions

**Priority:** P1  
**Status:** API `Implemented` (`GET /api/v1/portfolios/:portfolioId/decisions`); decision write endpoints `Deferred` (`BACKEND-ROADMAP.md` §7); UI `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Decisions are filterable by `assetId`, `direction`, `dateFrom` and
  `dateTo`; the list is not paginated.
- Given another user's portfolio, then 404.
- (FE) No decisions shows the decision-history empty state.

---

## FR-033 — Decision Detail

**Priority:** P1  
**Status:** API `Implemented` (`GET .../decisions/:decisionId`); UI `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Given a decision of the portfolio, then its stored fields (thesis,
  context, entry, exit, outcome, notes) are returned as stored.
- Given a decision of another portfolio or user, then 404.

---

## FR-034 — Replay Decision

**Priority:** P1  
**Status:** API `Implemented` (`GET /api/v1/decisions/:decisionId/replay`); payload values as decimal strings `Planned (B0)`; playback UI `Planned (FE)`  
**Decisions:** ADR-002 point 9

### Acceptance criteria

- The replay returns the decision's events in chronological order with the
  projected state at each step.
- Replay is read-only: it changes no stored decision or event.
- (B0) Prices and quantities in `DecisionEvent.payload` are read as
  `Decimal`, never as JavaScript numbers.
- (FE) Play, pause, previous, next, seek and restart move the replay
  position; the displayed state always matches the current step.
- (FE) With reduced motion, the replay is usable step by step (FR-065).

---

## FR-035 — Expected vs Actual

**Priority:** P2  
**Status:** `Deferred` — parked (`BACKEND-ROADMAP.md` §7); defined when scheduled.  
**Decisions:** —

Compares expected decision outcomes with observed outcomes where the data
exists.

---

# 13. Scenario Lab

## FR-036 — Create Scenario

**Priority:** P1  
**Status:** API `Implemented` (`POST .../scenarios`); UI `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Given a name, then 201 with a `DRAFT` scenario owned by the portfolio.
- Given an empty name, then 400.
- Creating, changing or calculating a scenario never changes the baseline
  portfolio, its positions or its transactions.
- Given another user's portfolio, then 404.

---

## FR-037 — Modify Scenario Variables

**Priority:** P1  
**Status:** per-asset price change (`changes[].percentChange`) `Implemented`; `Decimal` conversion `Planned (B0)`; other variables (position size, allocation, exposure) `Deferred`  
**Decisions:** ADR-002 point 9

### Acceptance criteria

- Given `PATCH` with `changes`, then the scenario stores them.
- Given an `ARCHIVED` scenario, then any modification is 409 `CONFLICT`.
- (B0) `percentChange` is converted to `Decimal` before any money
  arithmetic.

---

## FR-038 — Recalculate Scenario

**Priority:** P1  
**Status:** total value and unrealized P/L `Implemented` (`POST .../calculate`); allocation, risk and exposure outputs `Deferred` (`BACKEND-ROADMAP.md` §7)  
**Decisions:** `05-data-model.md` §16

### Acceptance criteria

- The result returns baseline metrics, scenario metrics and their
  difference in total value and unrealized P/L.
- Assets without a change keep their baseline price.
- Results are derived on request and never persisted.

---

## FR-039 — Reset Scenario

**Priority:** P1  
**Status:** API `Implemented` (`PATCH` with `changes: []`); UI action `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Given a scenario reset to no changes, then its calculation equals the
  baseline (zero difference).

---

## FR-040 — Save Scenario

**Priority:** P2  
**Status:** `Implemented` (`PATCH` with `status: SAVED`); UI `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- A saved scenario is returned by the list filtered with `status=SAVED`.

---

## FR-041 — Duplicate Scenario

**Priority:** P2  
**Status:** `Deferred` — parked (`BACKEND-ROADMAP.md` §7); defined when scheduled.  
**Decisions:** —

---

## FR-042 — Compare Scenarios

**Priority:** P1  
**Status:** API `Implemented` (`POST .../scenarios/compare`); UI `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Given 1 to 5 distinct scenario ids, then the result contains the baseline
  and, in request order, each scenario's metrics, its difference in total
  value (money and percent) and unrealized P/L, and per-asset rows.
- Given more than 5 ids or a repeated id, then 400.
- Given a scenario of another portfolio or user, then 404.
- The baseline-relative percent is `null` when the baseline value is zero.

---

## FR-043 — Delete Scenario

**Priority:** P2  
**Status:** `Implemented` (`DELETE .../scenarios/:scenarioId`, 204; archive also available); UI `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Given an owned scenario, then 204 and it no longer appears; another
  user's scenario is 404.

---

# 14. Real-Time Market Data

## FR-044 — Receive Market Updates

**Priority:** P1  
**Status:** `Planned (B5)`; client `Planned (FE)`  
**Decisions:** ADR-007 points 1, 4, 5, 6, 14

### Acceptance criteria

- Price updates arrive as `MARKET_PRICE_UPDATED` on `market:{assetId}` in the
  envelope `{ id, type, channel, sequence, timestamp, payload }`, validated
  by the schemas of `@trading/contracts`; money is a decimal string.
- `sequence` increases monotonically per channel; given a gap, the client
  resynchronizes through HTTP (there is no server replay buffer).
- `MarketPrice.change` stays measured against the last closed candle; the
  tick-to-tick delta exists only in the event payload.
- The page is never reloaded to show an update.

---

## FR-045 — Update Dependent State

**Priority:** P1  
**Status:** `Planned (B5)`; client recomputation `Planned (FE)`  
**Decisions:** ADR-004 point 1; ADR-007 points 6, 9; `16-analytics-spec.md` §8

### Acceptance criteria

- Given a price event for a held asset, then the client recomputes position
  value, unrealized P/L, portfolio value, `1D` change and current-state
  allocation and Pulse with the shared domain functions; the server does not
  push valuations per tick.
- Given a committed transaction, then `PORTFOLIO_UPDATED` is emitted and the
  client refetches the portfolio's data.
- Period analytics (FR-025 to FR-031) do not change on ticks: they cover
  closed days only and change when a day closes.
- Alerts are evaluated on the server on every tick (FR-053).

---

## FR-046 — Connection State

**Priority:** P1  
**Status:** `Planned (FE)`; simulating these states on demand in the demo `Deferred` (§21, demo failure scenarios)  
**Decisions:** ADR-007 points 2, 11, 12

### Acceptance criteria

- The UI shows `Connected`, `Connecting`, `Reconnecting`, `Disconnected` or
  `Failed` from the realtime port state.
- Given `Disconnected` or `Failed`, then a stale-data indicator is shown and
  data is refetched through HTTP periodically until reconnection.

---

## FR-047 — Reconnection

**Priority:** P2  
**Status:** `Planned (FE)`; demo simulation `Deferred` (§21)  
**Decisions:** ADR-007 points 2 and 5

### Acceptance criteria

- After a reconnect, the client authenticates in the first message,
  resubscribes and resynchronizes through HTTP.

---

# 15. Market Simulation

## FR-048 — Start Market Simulation

**Priority:** P1  
**Status:** engine and control `Planned (B5)`; demo controls `Planned (FE)`  
**Decisions:** ADR-005 point 2; ADR-007 points 7 and 10; `12-demo-mode-spec.md` §37-§40

### Acceptance criteria

- Starting, pausing and changing the simulation mode require
  `simulation:control` (`ADMIN`); a `VIEWER` or `TRADER` is denied.
- Modes and scenarios are those of `12-demo-mode-spec.md` §37-§40.
- The API and the demo use the same `@trading/market-sim` engine.

---

## FR-049 — Simulated Price Events

**Priority:** P1  
**Status:** `Planned (B5)`  
**Decisions:** ADR-007 points 7, 8, 14 and Deferred detail

The simulator generates synthetic prices; it does not represent real market
data.

### Acceptance criteria

- Given the same seed and clock, the engine produces the same price
  sequence.
- (Real mode) Each tick updates `MarketPrice` and appends a `MarketEvent`.
- At each UTC day rollover a daily `HistoricalPrice` candle is closed per
  asset and `MarketPrice.previousPrice` rolls to that close.
- Crash and restart: on startup the candles of the offline days are
  generated deterministically, so the daily series has no gaps.

---

## FR-050 — Simulation Isolation

**Priority:** P1  
**Status:** `Deferred` — in real mode the simulator persists prices and candles by design (ADR-007 point 8), so isolation applies only to the demo, whose data layers and reset are undecided (`05-data-model.md` §34-§35).  
**Decisions:** ADR-007 point 8

Simulated market activity must not irreversibly modify the demo's baseline
dataset, and demo sessions should be resettable (FR-072).

---

# 16. Notifications and Alerts

## FR-051 — Display Notifications

**Priority:** P1  
**Status:** API `Implemented` (`GET /api/v1/notifications`, `unreadOnly`); `NOTIFICATION_CREATED` `Planned (B5)`; UI `Planned (FE)`  
**Decisions:** ADR-007 points 3, 6, 9; ADR-010 point 9

### Acceptance criteria

- A user sees only their own notifications; `unreadOnly=true` returns only
  unread ones.
- (B5) A triggered alert creates a notification and emits
  `NOTIFICATION_CREATED` on the user's `notifications` channel.
- Notifications come only from triggered alerts and from CSV import jobs
  reaching `COMPLETED`, `FAILED` or `TIMED_OUT`; connection changes appear only in the
  status bar (ADR-010 point 9).

---

## FR-052 — Notification Lifecycle

**Priority:** P1  
**Status:** `Implemented` (`POST .../:notificationId/read`, `POST .../read-all`); UI `Planned (FE)`  
**Decisions:** ADR-010 point 3 (`unread` and `read` only; no `dismissed` state), point 9 (sources and severity); `05-data-model.md` §21

### Acceptance criteria

- Marking a notification read sets `readAt`; another user's notification is
  404.
- Mark-all-read returns 204 and leaves no unread notification for the user.
- Severity uses `NotificationSeverity` only, with no separate alert
  severity: triggered alert `WARNING`, import completed `SUCCESS`, import
  failed `ERROR` (ADR-010 point 9).

---

## FR-053 — Alert Conditions

**Priority:** P2  
**Status:** alert configuration `Implemented` (`/api/v1/alerts`, types `PRICE`, `PORTFOLIO_CHANGE`, `ALLOCATION`, `VOLATILITY`); evaluation `Planned (B5)`  
**Decisions:** ADR-007 point 9 and Deferred detail; ADR-010 point 9

### Acceptance criteria

- (B5) An alert fires when its condition changes from false to true and
  re-arms when it becomes false; it never fires on every tick.
- (B5) Each trigger creates a notification and emits `ALERT_TRIGGERED` and
  `NOTIFICATION_CREATED`.
- Persisted armed state, hysteresis and the initial state are specified in
  B5 (ADR-007 Deferred detail).
- (FE) Alerts are managed in an Alerts tab under Markets that lists every
  alert, and asset detail offers "Create alert" (ADR-010 point 9).

---

# 17. Global Search and Filtering

## FR-054 — Global Search

**Priority:** P2  
**Status:** `Deferred` — parked (`BACKEND-ROADMAP.md` §7); defined when scheduled.  
**Decisions:** —

---

## FR-055 — Sorting

**Priority:** P1  
**Status:** client-side sorting of fully loaded lists `Planned (FE)`; server-side sort parameters `Deferred`  
**Decisions:** ADR-010 point 4

### Acceptance criteria

- (FE) Given a fully loaded list (positions, watchlist, allocation,
  scenarios), sorting by a column reorders the view only; refetching
  returns the source order.
- Paginated lists keep the API's documented order (FR-014).

---

## FR-056 — Pagination

**Priority:** P1  
**Status:** `Implemented` for assets and transactions; other lists return complete results; UI `Planned (FE)`  
**Decisions:** ADR-002 point 2

### Acceptance criteria

- `page ≥ 1` (default 1) and `1 ≤ pageSize ≤ 100` (default 20); other values
  are 400.
- `meta` is `{ page, pageSize, total, totalPages }` with
  `totalPages = ceil(total / pageSize)`.
- A page beyond the last returns 200 with no items.
- (FE) The demo paginates through the same application use cases.

---

# 18. UI State Requirements

## FR-057 — Loading States

**Priority:** P0  
**Status:** `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Every request-backed view shows a loading state until its response or
  error arrives.
- Every mutation control is disabled while its request is pending, so one
  user action sends at most one request.
- A request that fails or times out leaves the loading state and shows the
  error state (FR-059).

---

## FR-058 — Empty States

**Priority:** P0  
**Status:** API `Implemented` (empty lists and zeroed metrics are 200, not errors); UI `Planned (FE)`  
**Decisions:** `16-analytics-spec.md` §2

### Acceptance criteria

- Given no portfolios, positions, transactions, search results, watchlist
  assets, saved scenarios or decisions, then the view shows an explicit
  empty state with the next available action.
- An empty portfolio (valid, zeroed) is shown differently from
  `InsufficientData` or `UNKNOWN` (data missing for something held).

---

## FR-059 — Error States

**Priority:** P0  
**Status:** API `Implemented` (error envelope, `requestId`, no internal details); UI `Planned (FE)`  
**Decisions:** ADR-002 point 2; ADR-009 point 6

### Acceptance criteria

- Every API error uses the envelope of §2; a 500 returns a generic message
  and never a stack trace or internal identifier other than `requestId`.
- Validation errors carry per-field `details`, shown next to the fields.
- (FE) Network failures and 5xx offer retry; a 400 offers correction, not
  retry; valid user state is preserved (FR-076).

---

## FR-060 — Success Feedback

**Priority:** P1  
**Status:** `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Creating a portfolio, recording a transaction, saving a scenario, adding a
  watchlist asset, updating preferences and starting an import each show a
  confirmation, announced to assistive technology (FR-064).

---

## FR-061 — Confirmation Dialogs

**Priority:** P1  
**Status:** `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Archiving a portfolio, deleting a scenario, deleting an alert and
  cancelling an import require confirmation; dismissing the dialog sends no
  request.

---

# 19. Responsive Behavior

## FR-062 — Responsive Layout

**Priority:** P0  
**Status:** `Planned (FE)`  
**Decisions:** ADR-010 point 9; `11-ui-ux-spec.md` §53-§57

### Acceptance criteria

- At every viewport size supported by `11-ui-ux-spec.md`, every P0 workflow
  can be completed without horizontal page scrolling.
- Layouts reorganize content by priority instead of scaling the desktop
  layout down.
- Breakpoints are 900 px and 560 px (`max-width`), and the minimum
  supported viewport width is 360 px (ADR-010 point 9).

---

# 20. Accessibility

## FR-063 — Keyboard Interaction

**Priority:** P1  
**Status:** `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Login, portfolio creation, transaction creation, CSV import and decision
  replay can be completed with the keyboard only, with visible focus.

---

## FR-064 — Accessible Feedback

**Priority:** P1  
**Status:** `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Form errors, success messages, alerts, loading states and dialog state
  changes are exposed to assistive technology (live regions, focus moved
  into opened dialogs and restored on close).

---

## FR-065 — Reduced Motion

**Priority:** P1  
**Status:** `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Given `prefers-reduced-motion: reduce`, non-essential animation is
  disabled and Decision Replay remains usable step by step.

---

# 21. Demo Functional Requirements

## FR-066 — Complete Demo Coverage

**Priority:** P0  
**Status:** `Planned (FE)`  
**Decisions:** ADR-001 points 1 and 4; ADR-002 point 5; ADR-006 points 1 and 7

### Acceptance criteria

- Every user-facing requirement whose status is not `Deferred` works in the
  demo through the in-process `TradingClient` adapter, with the same use
  cases and permission checks.
- The demo build makes no call to any backend and contains no secrets.

---

## FR-067 — Mock Persistence

**Priority:** P0  
**Status:** in-memory persistence within a session `Planned (FE)` (repositories `Planned (B0)`); persistence across reloads `Deferred` (demo data layers, `05-data-model.md` §34)  
**Decisions:** ADR-001 point 4 and Deferred detail

### Acceptance criteria

- Within one session, creating a portfolio, adding a transaction and then
  reading positions, metrics and analytics give results consistent with the
  real mode for the same data.
- (B0) Given a failure inside a unit of work, the in-memory `UnitOfWork`
  rolls back only that unit's writes, without erasing another unit's
  committed write.

---

## FR-068 — Mock API Behavior

**Priority:** P0  
**Status:** shared boundary `Planned (FE)`; simulated latency, timeouts and server errors `Deferred` (`00-overview.md` §6.3)  
**Decisions:** ADR-002 points 5 and 6

### Acceptance criteria

- The UI consumes the same DTOs through the same `TradingClient` port in both
  modes; in development, demo responses are validated against the
  `@trading/contracts` schemas.
- Validation errors in the demo come from the same application and domain
  rules as the API.

---

## FR-069 — Mock Background Processes

**Priority:** P1  
**Status:** `Planned (FE)`  
**Decisions:** ADR-008 points 3 and 13

### Acceptance criteria

- The demo runs the CSV import use case (FR-080) in process with simulated
  progress and injectable failures.
- Job states are those of FR-081; progress is a field, and retry is an
  action that returns a job to `QUEUED`, not a state.

---

## FR-070 — Mock Real-Time Events

**Priority:** P1  
**Status:** price events and dependent updates `Planned (FE)`; connection-state and reconnection simulation `Deferred` (FR-071)  
**Decisions:** ADR-007 point 13

### Acceptance criteria

- In the demo, prices change through the in-process realtime adapter fed by
  `@trading/market-sim`, and dependent values update as in FR-045.

---

## FR-071 — Demo Error Scenarios

**Priority:** P1  
**Status:** CSV import failure injection `Planned (FE)` (ADR-008 point 13); other scripted failures (request failure, timeout, connection loss) `Deferred` until the frontend-stage demo ADR (ADR-010 point 6)  
**Decisions:** ADR-008 point 13

### Acceptance criteria

- Validation errors and rejected operations (for example an oversell) occur
  in the demo through the real rules, without scripting.
- An injected import failure produces the same job states and failure
  reasons as FR-081.

---

## FR-072 — Demo Reset

**Priority:** P1  
**Status:** `Deferred` — demo data layers and reset are decided in the frontend-stage demo ADR (ADR-010 point 6; `05-data-model.md` §35).  
**Decisions:** —

The demo provides a reliable way to restore its initial seeded state
without manual browser-storage manipulation.

---

# 22. Data Integrity

## FR-073 — Consistent Derived State

**Priority:** P0  
**Status:** `Implemented` (position updated in the same unit of work; overview and analytics derived on read); position rebuild for backdated transactions `Planned (B0)`; UI refresh `Planned (FE)`  
**Decisions:** ADR-003 point 6; `05-data-model.md` §8, §32

### Acceptance criteria

- Given a 201 on transaction creation, then an immediate read of positions
  and overview reflects it.
- (B0) Given a backdated transaction, then the position (quantity and
  average cost) equals a replay of the asset's transactions in date order.

---

## FR-074 — Atomic Business Operations

**Priority:** P0  
**Status:** `Implemented` for transaction creation; CSV import apply `Planned (B4)`; in-memory `UnitOfWork` `Planned (B0)`  
**Decisions:** ADR-001 Deferred detail; ADR-008 points 2 and 5

### Acceptance criteria

- Given a failure after the transaction insert, then no transaction row and
  no position change remain.
- (B4) Given an import with an invalid row, then nothing is written; given a
  failure during apply, then no imported row remains and the job is not
  `COMPLETED`.
- (B4) The job's `COMPLETED` state is written in the same database
  transaction as the imported rows.

---

# 23. Error Recovery

## FR-075 — Retry Failed Operation

**Priority:** P1  
**Status:** `Idempotency-Key` and job retry `Planned (B4)`; UI `Planned (FE)`  
**Decisions:** ADR-008 points 6 and 8

### Acceptance criteria

- (FE) A retried transaction creation reuses the original
  `Idempotency-Key`, so the retry never creates a second transaction
  (FR-082).
- (B4) Job retry follows FR-081; a `VALIDATION_FAILED` import is not
  retryable and the user creates a new import.

---

## FR-076 — Preserve User Input

**Priority:** P1  
**Status:** `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Given a failed submission (400, 5xx or network error), the form keeps
  the values entered and marks the invalid fields from `details`.

---

# 24. State Synchronization

## FR-077 — Synchronize Related Views

**Priority:** P1  
**Status:** client invalidation `Planned (FE)`; `PORTFOLIO_UPDATED` `Planned (B5)`  
**Decisions:** ADR-007 point 6

### Acceptance criteria

- Given a successful mutation, then transactions, positions, overview and
  analytics of that portfolio are refreshed without a page reload.
- (B5) Given a change made in another tab or session, then
  `PORTFOLIO_UPDATED` makes the client refetch the same views.

---

# 25. Product Interaction Integrity

## FR-078 — No Non-Functional Primary Actions

**Priority:** P0  
**Status:** `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Every primary control in the released UI performs the behavior of a
  requirement whose status is not `Deferred`; no control exists only as a
  visual placeholder.

---

## FR-079 — Consistent Interaction Feedback

**Priority:** P1  
**Status:** `Planned (FE)`  
**Decisions:** —

### Acceptance criteria

- Every user action produces a visible result stating that it succeeded,
  failed, is processing, needs more input or is not allowed for the
  current role.

---

# 25.1 Requirements Added From ADRs

**Status:** per requirement

These requirements cover behavior an ADR decides and no earlier FR covered.

## FR-080 — CSV Transaction Import

**Priority:** P1  
**Status:** `Planned (B4)`; UI and demo `Planned (FE)`  
**Decisions:** ADR-008 points 1, 2, 4, 9, 10, 13 and Deferred detail; ADR-003 point 6; ADR-004 point 12

A `TRADER` imports historical `BUY` and `SELL` transactions from a CSV file
into a portfolio as a background job.

### Acceptance criteria

- `POST /api/v1/portfolios/:portfolioId/imports` creates a `QUEUED` job and
  stores the CSV content in the job row; it requires `transaction:create`;
  another user's portfolio is 404.
- Given a file above the size or row limit (values fixed in B4), then
  creation is rejected and no job is created.
- Validate stage: every row passes the FR-018 rules, including chronological
  validation against existing transactions and earlier rows; rows with the
  same `executedAt` are ordered by row order.
- Given any invalid row, then the job ends `FAILED` with reason
  `VALIDATION_FAILED`, a per-row report, and nothing written.
- Apply stage: all rows are written in one `UnitOfWork` that re-checks the
  invariants. A business-rule rejection (for example a concurrent
  transaction now makes a row oversell) ends `FAILED` with `APPLY_REJECTED`;
  a technical failure ends `FAILED` with `APPLY_ERROR`; in both cases no row
  is written.
- No partial import can exist.

---

## FR-081 — Import Job Lifecycle

**Priority:** P1  
**Status:** `Planned (B4)`; `jobs:{jobId}` events `Planned (B5)`; UI `Planned (FE)`  
**Decisions:** ADR-008 points 3, 5, 6, 7, 9, 11 and Deferred detail; ADR-010 point 9

### Acceptance criteria

- States are exactly `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`,
  `CANCELLED`, `TIMED_OUT`; progress is `{ processed, total }`.
- `GET /api/v1/jobs/:jobId` returns state, progress, `attempt` and failure
  reason; another user's job is 404.
- `POST .../retry` is allowed for `TIMED_OUT`, `CANCELLED` and `FAILED` with
  `INTERRUPTED`, `APPLY_ERROR` or `APPLY_REJECTED`: the job returns to
  `QUEUED`, `attempt` increments, and validation reruns from the start. For
  `VALIDATION_FAILED` or any other state, retry is rejected and the job is
  unchanged.
- `POST .../cancel` is allowed while `QUEUED` or validating; during apply it
  is rejected.
- Retry and cancel require `transaction:create` on an owned job.
- Timeout: a job `QUEUED` or validating beyond its per-attempt timeout,
  measured from when it was queued, becomes `TIMED_OUT`; the apply stage is
  exempt.
- Crash and restart: on startup a `PROCESSING` job becomes `FAILED` with
  `INTERRUPTED` (it wrote nothing) and every `QUEUED` job resumes.
- Concurrency: every transition is a compare-and-set on status; a cancel
  racing a committing apply never leaves imported rows with a job that is
  not `COMPLETED`, and startup resume and enqueue never run a job twice.
- (B5) `jobs:{jobId}` carries `JOB_PROGRESS_UPDATED`, `JOB_COMPLETED` and
  `JOB_FAILED`.
- (B4) A job reaching `COMPLETED` creates a `SUCCESS` notification and a job
  reaching `FAILED` or `TIMED_OUT` creates an `ERROR` notification for its
  owner; `CANCELLED` creates none (ADR-008 point 6, ADR-010 point 9).
- (B4) Retry or cancel in a state that does not allow it returns 409
  `CONFLICT` and changes nothing (ADR-008 point 6).

---

## FR-082 — Idempotent Mutations

**Priority:** P1  
**Status:** `Planned (B4)`  
**Decisions:** ADR-008 point 8 and Deferred detail

### Acceptance criteria

- `Idempotency-Key` is accepted on `POST /portfolios/:id/transactions` and
  on import creation; keys are scoped per user and kept 24 hours.
- Given a repeated key with the same request, then the stored response is
  returned and no second effect occurs.
- Given a repeated key with a different request (hash of method, route,
  path parameters and body), then 409 `CONFLICT`.
- Given two in-flight requests with the same key, then the second gets 409.
- The key and its response are written in the same `UnitOfWork` as the
  mutation, so a crash between commit and record cannot duplicate on retry.
- 5xx outcomes are not stored; an expired reservation lease or a key older
  than 24 hours counts as absent.

---

## FR-083 — Session Refresh

**Priority:** P0  
**Status:** `Planned (B2)`; client flow `Planned (FE)`  
**Decisions:** ADR-005 points 4-7, 9 and Deferred detail; ADR-009 point 9

### Acceptance criteria

- `POST /api/v1/auth/refresh` with a valid refresh cookie and the custom
  header returns a new access token and rotates the refresh token.
- The refresh token is opaque, stored hashed, and sent in a cookie with
  `HttpOnly`, `Secure`, `SameSite=Strict` and `Path=/api/v1/auth`.
- Given an already-rotated token presented after the grace window, then the
  whole token family is revoked and `auth.refresh.reuse_detected` is logged.
- Given parallel refreshes within the grace window (about 10 seconds), then
  each receives the same successor pair and no revocation occurs, including
  when the first response was lost.
- Given a family past its idle timeout or absolute lifetime, then refresh
  returns 401.
- A role change takes effect at the next refresh, within 15 minutes.
- Given a token carrying an unknown role, then 401.

---

## FR-084 — Roles and Permissions

**Priority:** P0  
**Status:** ownership checks (404) `Implemented`; permission checks in the application layer `Planned (B0)`; roles `VIEWER`, `TRADER`, `ADMIN` `Planned (B2)`  
**Decisions:** ADR-005 points 1, 2, 3, 10, 11, 12, 13

### Acceptance criteria

- Roles are `VIEWER`, `TRADER` and `ADMIN`; existing `USER` accounts become
  `TRADER`.
- A `VIEWER` reads own resources, mutates no domain data, and may update its
  own preferences and mark its own notifications read (ADR-005 point 13); a
  `TRADER` performs every supported mutation on own resources; an `ADMIN`
  holds the `TRADER` permissions plus `simulation:control` only in version 1.
- Code checks permissions, never role names; every use case receives an
  `Actor { userId, role }` and checks permission and ownership.
- Another user's resource is 404, never 403.
- The API and the demo enforce identical rules.
- There is no self-registration.

---

## FR-085 — Analytics Data Boundaries

**Priority:** P0  
**Status:** `Planned (B1)`  
**Decisions:** ADR-004 points 1, 4, 6, 7; `16-analytics-spec.md` §2, §5, §8

### Acceptance criteria

- Given a `to` after the last closed UTC day (or omitted), then it is
  clamped to that day and the response states `asOf`; given the last closed
  day `2026-03-31` and `to = 2026-04-02`, then `asOf = 2026-03-31` and a
  `BUY` on 2026-04-01 changes neither value, flows nor `twrPercent`.
- Given a `from` before the first available data, then the period is
  clamped and the response states `effectiveFrom`; values are never
  extrapolated.
- Given `from ≤ to` with `from` after the last closed day, then 200 with
  `InsufficientData` and `asOf`, and no `twrPercent` or P/L value.
- A held asset without any price on or before a day makes that range
  `InsufficientData`; otherwise the last close is carried forward.
- An empty portfolio is a valid zeroed result, distinct from
  `InsufficientData` and `UNKNOWN`.
- Day boundaries are UTC calendar dates in the API, the demo and the
  simulator.

---

## FR-086 — Realtime Session and Subscriptions

**Priority:** P1  
**Status:** `Planned (B5)`  
**Decisions:** ADR-007 points 2, 3, 11 and Deferred detail

### Acceptance criteria

- The client sends the access token in the first message, never in the URL;
  a connection not authenticated within 5 seconds is closed.
- Given the token expires without re-authentication, then the server closes
  the socket; re-authentication on the same socket extends the bound.
- Each re-authentication reloads role and ownership and drops subscriptions
  the actor may no longer hold; re-authentication with another user's token
  closes the socket.
- Subscribing to `portfolio:{portfolioId}` of another user is denied;
  `notifications` is scoped to the authenticated user.
- A heartbeat runs every 30 seconds; subscriptions per connection and
  inbound message rate are limited.

---

## FR-087 — User Preferences

**Priority:** P1  
**Status:** `Implemented` (`GET` and `PATCH /api/v1/preferences`); `en`/`es` language validation `Planned (B0)`; settings UI `Planned (FE)`  
**Decisions:** ADR-010 point 8; `05-data-model.md` §23; `07-api-spec.md` §29

The user reads and updates their own preferences: theme, language, default
portfolio, reduced motion and notification preferences.

### Acceptance criteria

- Given a user with no stored preferences, `GET` returns `null` (not 404)
  and writes nothing; the client applies the application defaults.
- `PATCH` with at least one field creates the row on first use (atomic
  upsert) or updates it, and returns the stored preferences.
- `PATCH` with no field, an empty `theme` or an empty `language` returns
  400 `VALIDATION_ERROR`.
- (B0) `language` accepts only `en` or `es` (ADR-010 point 8); any other
  value returns 400 `VALIDATION_ERROR` and changes nothing.
- (B0) `theme` accepts only `light`, `dark` or `system` (default `system`);
  any other value returns 400 `VALIDATION_ERROR` and changes nothing
  (ADR-002 point 10).
- `defaultPortfolioId` set to another user's portfolio, or to one that does
  not exist, returns 404 and changes nothing; `null` clears it.
- Preferences are always the caller's: there is no user identifier in the
  route.
- (FE) `reducedMotion` disables non-essential motion (FR-065); `theme` and
  `language` apply without reloading the page.
- (FE) The whole UI is available in English and Spanish (NFR-066). The
  initial language is English; Spanish applies only after the user selects
  it. The browser language is ignored.

---

# 26. Requirement Traceability

**Status:** `Reference` (table below); test traceability per
`10-testing-strategy.md`

Each requirement maps to its decisions, implementing block and tests:

```text
FR-XXX → ADR / spec section → block → implementation → tests → acceptance criteria
```

Code comments and tests cite the FR ID.

---

# 27. Functional Completeness

**Status:** `Planned (FE)`

The initial release is functionally complete when every requirement whose
status is not `Deferred` meets its acceptance criteria in both runtimes,
and the backend blocks B0-B7 are closed (`BACKEND-ROADMAP.md` §2).

---

# 28. Requirement Change Policy

**Status:** `Reference`

A requirement changes when implementation reveals an invalid assumption, a
better behavior, a technical constraint, a usability problem or unnecessary
complexity. The change is made in this document in the same pull request as
the code (`README.md`, maintenance rule). A change that reopens a decision
needs a new ADR first. IDs are never reused or deleted.

---

# 29. Functional Guiding Principle

**Status:** `Reference`

A feature is implemented when the whole path works, not when its UI exists:

```text
User intent → Interaction → Validation → Processing → State change
→ Dependent updates → Feedback → Recoverable failure path
```

This applies equally to the full stack and to the public demo.

---

# 30. Traceability Table

**Status:** `Reference`

| FR | Status | Decisions / spec | Block |
| --- | --- | --- | --- |
| FR-001 | `Implemented`; `Planned (B2)`, `Planned (FE)` | ADR-005 p4, 8, 10-12 | B2, FE |
| FR-002 | `Planned (B2)` | ADR-005 p4-6, 9 | B2, FE |
| FR-003 | `Planned (B2)` | ADR-005 p6-7 | B2, FE |
| FR-004 | `Implemented`; `Planned (B1)` | ADR-004 p5, 11; `16` §11-15 | B1, FE |
| FR-005 | `Planned (FE)` | — | FE |
| FR-006 | `Planned (B1)`; UI `Planned (FE)` | ADR-010 p1 | B1, FE |
| FR-007 | `Implemented`; `Planned (B1)` | ADR-004 p11; `16` §15 | B1 |
| FR-008 | `Implemented` | ADR-005 p12 | FE |
| FR-009 | `Implemented`; `Planned (B2)` | ADR-004 p12; ADR-005 p2 | B2, FE |
| FR-010 | `Implemented` | `05` §43 | FE |
| FR-011 | `Implemented` (archive); read-only `Planned (B0)` | ADR-010 p5 | B0, FE |
| FR-012 | `Implemented`; `Planned (B1)`, `Planned (B5)` | ADR-004 p15; ADR-007 | B1, B5, FE |
| FR-013 | `Implemented` | ADR-001 p6 | FE |
| FR-014 | `Implemented`; `Planned (B1)` | ADR-003 p4; ADR-004 p15 | B1, FE |
| FR-015 | Satisfied by FR-016 and FR-020 | ADR-010 p2 | — |
| FR-016 | `Implemented` | ADR-003 p1 | FE |
| FR-017 | `Implemented`; `Planned (B0)`, `Planned (B4)`, `Planned (B5)` | ADR-001; ADR-003; ADR-007 p6; ADR-008 p8, 12 | B0, B4, B5, FE |
| FR-018 | `Implemented`; `Planned (B0)`, `Planned (B1)` | ADR-003 p6; ADR-004 p2, 12 | B0, B1 |
| FR-019 | `Implemented` | — | FE |
| FR-020 | `Implemented`; `Planned (B7)` | — | B7, FE |
| FR-021 | `Implemented`; parts `Deferred` | ADR-007 p14 | FE |
| FR-022 | `Implemented` | `05` §17 | FE |
| FR-023 | `Implemented` | — | FE |
| FR-024 | `Planned (B5)` | ADR-007 p3, 5, 12, 13 | B5, FE |
| FR-025 | `Planned (B1)`; `1D` `Implemented` | ADR-004 p1-6, 14; `16` §2-8 | B1 |
| FR-026 | `Planned (B1)` | ADR-004 p1, 4, 7; `16` §3, §7 | B1, FE |
| FR-027 | `Implemented`; sector `Deferred` | ADR-004 p12-13; `16` §13 | — |
| FR-028 | `Planned (B1)` | ADR-004 p9; `16` §10 | B1 |
| FR-029 | `Planned (B1)` | ADR-004 p8; `16` §9 | B1 |
| FR-030 | `Implemented`; `Planned (B1)` | ADR-004 p10; `16` §14 | B1 |
| FR-031 | `Planned (B1)`; factors `Deferred` | ADR-004 p10 | B1 |
| FR-032 | `Implemented` | — | FE |
| FR-033 | `Implemented` | — | FE |
| FR-034 | `Implemented`; `Planned (B0)` | ADR-002 p9 | B0, FE |
| FR-035 | `Deferred` | — | — |
| FR-036 | `Implemented` | — | FE |
| FR-037 | `Implemented`; `Planned (B0)` | ADR-002 p9 | B0, FE |
| FR-038 | `Implemented`; parts `Deferred` | `05` §16 | FE |
| FR-039 | `Implemented` | — | FE |
| FR-040 | `Implemented` | — | FE |
| FR-041 | `Deferred` | — | — |
| FR-042 | `Implemented` | — | FE |
| FR-043 | `Implemented` | — | FE |
| FR-044 | `Planned (B5)` | ADR-007 p1, 4-6, 14 | B5, FE |
| FR-045 | `Planned (B5)` | ADR-004 p1; ADR-007 p6, 9 | B5, FE |
| FR-046 | `Planned (FE)` | ADR-007 p2, 11-12 | FE |
| FR-047 | `Planned (FE)` | ADR-007 p2, 5 | FE |
| FR-048 | `Planned (B5)` | ADR-005 p2; ADR-007 p7, 10 | B5, FE |
| FR-049 | `Planned (B5)` | ADR-007 p7-8, 14 | B5 |
| FR-050 | `Deferred` | ADR-007 p8, ADR-010 p6 | — |
| FR-051 | `Implemented`; `Planned (B5)` | ADR-007 p3, 6, 9; ADR-010 p9 | B5, FE |
| FR-052 | `Implemented` | ADR-010 p3, 9 | FE |
| FR-053 | `Implemented`; `Planned (B5)` | ADR-007 p9; ADR-010 p9 | B5, FE |
| FR-054 | `Deferred` | — | — |
| FR-055 | `Planned (FE)`; server sort `Deferred` | ADR-010 p4 | FE |
| FR-056 | `Implemented` | ADR-002 p2 | FE |
| FR-057 | `Planned (FE)` | — | FE |
| FR-058 | `Implemented`; `Planned (FE)` | `16` §2 | FE |
| FR-059 | `Implemented`; `Planned (FE)` | ADR-002 p2; ADR-009 p6 | FE |
| FR-060 | `Planned (FE)` | — | FE |
| FR-061 | `Planned (FE)` | — | FE |
| FR-062 | `Planned (FE)` | ADR-010 p9; `11` | FE |
| FR-063 | `Planned (FE)` | — | FE |
| FR-064 | `Planned (FE)` | — | FE |
| FR-065 | `Planned (FE)` | — | FE |
| FR-066 | `Planned (FE)` | ADR-001 p1, 4; ADR-002 p5; ADR-006 p1, 7 | FE |
| FR-067 | `Planned (FE)`; reloads `Deferred` | ADR-001 p4, ADR-010 p6 | B0, FE |
| FR-068 | `Planned (FE)`; latency and failures `Deferred` | ADR-002 p5-6, ADR-010 p6 | FE |
| FR-069 | `Planned (FE)` | ADR-008 p3, 13 | FE |
| FR-070 | `Planned (FE)` | ADR-007 p13 | FE |
| FR-071 | `Planned (FE)`; other failures `Deferred` | ADR-008 p13, ADR-010 p6 | FE |
| FR-072 | `Deferred` | ADR-010 p6 | FE |
| FR-073 | `Implemented`; `Planned (B0)` | ADR-003 p6; `05` §8, §32 | B0, FE |
| FR-074 | `Implemented`; `Planned (B0)`, `Planned (B4)` | ADR-001; ADR-008 p2, 5 | B0, B4 |
| FR-075 | `Planned (B4)` | ADR-008 p6, 8 | B4, FE |
| FR-076 | `Planned (FE)` | — | FE |
| FR-077 | `Planned (FE)`; `Planned (B5)` | ADR-007 p6 | B5, FE |
| FR-078 | `Planned (FE)` | — | FE |
| FR-079 | `Planned (FE)` | — | FE |
| FR-080 | `Planned (B4)` | ADR-008 p1-2, 4, 9-10, 13; ADR-003 p6; ADR-004 p12 | B4, FE |
| FR-081 | `Planned (B4)` | ADR-008 p3, 5-7, 9, 11; ADR-010 p9 | B4, B5, FE |
| FR-082 | `Planned (B4)` | ADR-008 p8 | B4 |
| FR-083 | `Planned (B2)` | ADR-005 p4-7, 9; ADR-009 p9 | B2, FE |
| FR-084 | `Implemented`; `Planned (B0)`, `Planned (B2)` | ADR-005 p1-3, 10-12 | B0, B2 |
| FR-085 | `Planned (B1)` | ADR-004 p1, 4, 6-7; `16` §2, §5, §8 | B1 |
| FR-086 | `Planned (B5)` | ADR-007 p2-3, 11 | B5 |
| FR-087 | `Implemented`; language validation `Planned (B0)`; UI `Planned (FE)` | ADR-010 p8, `05` §23 | B0, FE |

---

## Functional Requirements Summary

The platform provides one coherent product in two runtimes: the public demo
simulates infrastructure, not functionality, and the full stack implements
the real infrastructure. Both preserve the same behavior:

> **Observe what is happening, understand why it happened, replay decisions, and explore possible outcomes through a coherent analytical workspace.**
