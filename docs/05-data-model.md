# SDD 05 — Data Model

**Project:** Trading Analytics Platform  
**Status:** Reconciled with `packages/database/prisma/schema.prisma` on 2026-10-05  
**Version:** 2.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`  
**Decisions:** ADR-003 (`adr/0003-holdings-only-portfolio.md`), ADR-004 (`adr/0004-analytics-methodology.md`), ADR-005 (`adr/0005-roles-and-authentication.md`), ADR-007 (`adr/0007-realtime-and-market-simulation.md`), ADR-008 (`adr/0008-background-jobs-csv-import.md`)

---

# 1. Purpose

**Status:** `Implemented`

This document defines the persisted data model and the derived models built
on it. Persisted entities are documented exactly as they exist in
`schema.prisma`; anything not yet in the schema is marked `Planned (B#)`,
`Planned (FE)` or `Deferred` (legend in `docs/README.md`). Section numbers are stable because
code comments cite them.

Reading the field tables:

- **Type** is the Prisma type; `Decimal(p, s)` is PostgreSQL `DECIMAL(p, s)`,
  `Float` is `DOUBLE PRECISION`, `DateTime` is `TIMESTAMP(3)` (see §40).
- **Null** is `yes` when the column is nullable.
- **Default** is the database or Prisma default; `@updatedAt` is set by
  Prisma on every update. A default supplied by application code is noted in
  **Notes**, not here.
- Column names are `snake_case` (`@map`); table names are given per entity.

Each section ends with **Open detail** when an edge case is undecided. Open
details do not change any ADR decision; each is assigned to the block that
specifies and tests it.

---

# 2. Data Modeling Principles

**Status:** `Implemented`

1. Single source of truth for primary data (§31).
2. Derived values are recalculated, not duplicated. `Position` is the one
   stored projection (§8).
3. Relationships are enforced by foreign keys with explicit `onDelete`.
4. Business calculations are reproducible from persisted inputs.
5. Historical facts are kept separate from current state (§43).
6. Seed data behaves like real application data (§33).
7. Infrastructure aligns to the domain entities in `packages/domain`, not the
   reverse.

---

# 3. Domain Overview

**Status:** `Implemented`

```text
User
 ├── Credential            (0..1)
 ├── UserPreference        (0..1)
 ├── Portfolio             (0..n)
 │     ├── Transaction ──► Asset
 │     ├── Position ─────► Asset
 │     ├── Decision ─────► Asset
 │     │     └── DecisionEvent
 │     ├── Scenario
 │     └── Alert (portfolio-scoped)
 ├── WatchlistItem ──────► Asset
 ├── Alert ──────────────► Asset (optional)
 └── Notification

Asset
 ├── MarketPrice           (0..1, current)
 ├── MarketEvent           (0..n, ticks)
 └── HistoricalPrice       (0..n, daily candles)
```

Planned entities (not in the schema): `Session` (§5.3, B2), `Job` (§52, B4),
`IdempotencyKey` (§53, B4).

---

# 4. Entity Classification

**Status:** `Implemented`

| Category | Entities | Status |
| --- | --- | --- |
| Primary | User, Portfolio, Asset, Position, Transaction, Decision, DecisionEvent, Scenario | `Implemented` |
| Supporting | Credential, WatchlistItem, Alert, Notification, UserPreference | `Implemented` |
| Market | MarketPrice, MarketEvent, HistoricalPrice | `Implemented` |
| Auth | Session | `Planned (B2)` |
| Jobs and retries | Job, IdempotencyKey | `Planned (B4)` |
| Derived (never persisted) | PortfolioMetrics, PositionMetrics, AllocationMetrics, PerformanceMetrics, Attribution, DrawdownMetrics, VolatilityMetrics, PortfolioPulse, ScenarioResult | see §24-29, §16 |

Derived models are not persisted. Caching is not introduced until measured
(ADR-004, Consequences).

---

# 5. User

**Status:** `Implemented` — table `users`. Role values: `Planned (B2)`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `email` | `String` | no | — | unique (`users_email_key`) |
| `displayName` | `String` | no | — | |
| `role` | `UserRole` | no | `USER` | |
| `createdAt` | `DateTime` | no | `now()` | |
| `updatedAt` | `DateTime` | no | `@updatedAt` | |

Relations: `portfolios`, `watchlistItems`, `alerts`, `notifications`,
`preference` (0..1), `credential` (0..1). Deleting a user cascades to all of
them.

Users come from the seed; registration is out of scope (ADR-005 point 10).

Open detail (B2): `email` uniqueness is case-sensitive at the database level;
whether login normalizes case is not specified.

## 5.1 Role

**Status:** `Implemented` (`USER`, `ADMIN`); target set `Planned (B2)`.

| Enum `UserRole` (`user_role`) | Status |
| --- | --- |
| `USER` | `Implemented`; renamed to `TRADER` in B2 |
| `ADMIN` | `Implemented` |
| `VIEWER` | `Planned (B2)` |
| `TRADER` | `Planned (B2)` |

ADR-005 point 1 replaces the role set with `VIEWER`, `TRADER`, `ADMIN`.
Per ADR-005 Deferred detail, the migration is hand-written
(`RENAME VALUE 'USER' TO 'TRADER'`, `ADD VALUE 'VIEWER'`), the column default
moves off `USER`, and tokens carrying an unknown role are rejected with 401.
Code checks permissions, never role names (ADR-005 point 2).

## 5.2 Credential

**Status:** `Implemented` — table `credentials`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `userId` | `String` | no | — | PK and FK to `User`, `onDelete: Cascade` |
| `passwordHash` | `String` | no | — | `bcryptjs` hash (ADR-005 point 12) |
| `createdAt` | `DateTime` | no | `now()` | |
| `updatedAt` | `DateTime` | no | `@updatedAt` | |

Kept separate from `User` so password handling is its own capability
(`packages/domain/src/entities/credential.ts`).

## 5.3 Session

**Status:** `Planned (B2)` — ADR-005 points 5-6 and Deferred detail.

A sessions table holds refresh-token state. Required by the ADR:

- the refresh token, stored only as a hash; rotated on every use;
- a token family, so presenting an already-rotated token revokes the whole
  family;
- revocation (logout revokes the session);
- an idle timeout and an absolute family lifetime (`expiresAt`), matching the
  cookie `Max-Age`;
- for the refresh grace window (about 10 seconds), the successor refresh token
  kept recoverable (encrypted at rest) and cleared when the window ends.

Open detail (B2): exact columns, a unique index on the token hash, and
purging of expired families.

---

# 6. Portfolio

**Status:** `Implemented` — table `portfolios`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `userId` | `String` | no | — | FK to `User`, `onDelete: Cascade`; indexed |
| `name` | `String` | no | — | not unique |
| `description` | `String` | yes | — | |
| `baseCurrency` | `String` | no | — | ISO code; immutable after creation (application rule, §43) |
| `status` | `PortfolioStatus` | no | `ACTIVE` | |
| `createdAt` | `DateTime` | no | `now()` | |
| `updatedAt` | `DateTime` | no | `@updatedAt` | |

Enum `PortfolioStatus` (`portfolio_status`): `ACTIVE`, `ARCHIVED`.

Relations: `transactions`, `positions`, `decisions`, `scenarios`, `alerts`;
deleting a portfolio cascades to all of them. Archiving is a status change and
is preferred over deletion (§42).

Version 1 is single-currency: every transaction's asset currency must equal
`baseCurrency` (ADR-004 point 12, `Planned (B1)`).

---

# 7. Asset

**Status:** `Implemented` — table `assets`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `symbol` | `String` | no | — | unique (`assets_symbol_key`) |
| `name` | `String` | no | — | |
| `assetType` | `AssetType` | no | — | |
| `currency` | `String` | no | — | ISO code |
| `exchange` | `String` | no | — | required, matches the domain entity |
| `status` | `AssetStatus` | no | `ACTIVE` | |
| `metadata` | `Json` | no | `{}` | untyped |

Enum `AssetType` (`asset_type`): `STOCK`, `ETF`, `CRYPTO`, `FOREX`.
Enum `AssetStatus` (`asset_status`): `ACTIVE`, `INACTIVE`.

`Asset` has no timestamps. Deleting an asset is blocked (`Restrict`) while any
`Transaction`, `Position` or `Decision` references it; `WatchlistItem`,
`Alert`, `MarketPrice`, `MarketEvent` and `HistoricalPrice` rows cascade.

A sector field is `Deferred` (ADR-004 point 13); `metadata` is not used for
grouping.

---

# 8. Position

**Status:** `Implemented` — table `positions`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `portfolioId` | `String` | no | — | FK to `Portfolio`, `onDelete: Cascade` |
| `assetId` | `String` | no | — | FK to `Asset`, `onDelete: Restrict` |
| `quantity` | `Decimal(18, 8)` | no | — | |
| `currency` | `String` | no | — | shared by both prices |
| `averageEntryPrice` | `Decimal(18, 8)` | no | — | weighted average cost; see fees below |
| `currentPrice` | `Decimal(18, 8)` | no | — | see Open detail |
| `openedAt` | `DateTime` | no | — | set by the mapper to the current time on create |
| `updatedAt` | `DateTime` | no | `@updatedAt` | |

Unique: `(portfolioId, assetId)` — one position per asset per portfolio.

A position is a stored projection of the transaction history. It is written
only inside the transaction-creation unit of work (§9): the previous position
plus the new transaction gives the new state, which is upserted, or the row is
deleted when a `SELL` closes it exactly. A position with zero quantity is
never stored. Positions are never edited directly.

Fees in cost basis (`Planned (B1)`, ADR-004 point 15, decided 2026-10-05):
`averageEntryPrice` includes `BUY` fees, as
`(heldQuantity × averageEntryPrice + quantity × price + fees) /
(heldQuantity + quantity)`; a `SELL` leaves it unchanged and its fees are
subtracted from realized P/L. Today (`Implemented`,
`position-recalculation.ts`) it excludes fees, so unrealized P/L (§25) will
be lower by the `BUY` fees of the held units. Formulas and tests are in
`16-analytics-spec.md` §12.

Open detail:

- (B0) The projection is updated incrementally from the current row. With
  backdated transactions (allowed by ADR-003 point 6), average entry price and
  `openedAt` depend on date order, so the projection must be rebuilt by
  replaying the asset's transactions in date order, as chronological
  validation already requires.
- (B5) `currentPrice` keeps the last trade price while `MarketPrice` ticks:
  drop it and read `MarketPrice`, or update it per tick (ADR-007 Deferred
  detail).
- (B0) Two concurrent transactions on the same portfolio and asset race on
  the read-modify-write of this row (`BACKEND-ROADMAP.md` §4).

---

# 9. Transaction

**Status:** `Implemented` — table `transactions`. Validation rules marked below.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `portfolioId` | `String` | no | — | FK to `Portfolio`, `onDelete: Cascade`; indexed |
| `assetId` | `String` | no | — | FK to `Asset`, `onDelete: Restrict`; indexed |
| `type` | `TransactionType` | no | — | |
| `status` | `TransactionStatus` | no | `DRAFT` | see §10 |
| `quantity` | `Decimal(18, 8)` | no | — | |
| `price` | `Decimal(18, 8)` | no | — | per unit |
| `fees` | `Decimal(18, 8)` | no | `0` | |
| `currency` | `String` | no | — | shared by `price` and `fees` |
| `executedAt` | `DateTime` | no | — | event time; application defaults it to now when omitted |
| `createdAt` | `DateTime` | no | `now()` | |

Transactions are historical facts: only `status` is ever updated (§43).
Listing order is `executedAt` descending, then `id` descending.

## 9.1 Transaction types

| Enum `TransactionType` (`transaction_type`) | Status |
| --- | --- |
| `BUY`, `SELL` | `Implemented` |
| `DEPOSIT`, `WITHDRAWAL`, `DIVIDEND`, `FEE` | `Deferred` — only with a cash ledger in a new ADR (ADR-003 point 5) |

There is no cash balance (ADR-003 point 2). Fees are the `fees` field, not a
type (ADR-003 point 1).

## 9.2 Validation

| Rule | Status |
| --- | --- |
| `quantity > 0`, `price > 0`, `fees >= 0`, fee currency equals price currency, `executedAt` not in the future | `Implemented` (`packages/domain/src/entities/transaction.ts`) |
| Overselling rejected against the current position (`InsufficientPositionQuantityError`) | `Implemented` |
| Holding stays non-negative at `executedAt` and after every later transaction, replayed in date order (ADR-003 point 6) | `Planned (B0)` |
| Same-`executedAt` tiebreak: `executedAt`, then creation order (row order for an import) (ADR-003 Deferred detail) | `Planned (B0)` |
| Asset currency equals portfolio `baseCurrency`, else 400 (ADR-004 point 12) | `Planned (B1)` |
| `SELL` with `fees > quantity × price` rejected with 400, so outflows are never negative; fees equal to the gross proceeds are accepted (ADR-004 point 2, amended 2026-10-05) | `Planned (B1)` |
| `Idempotency-Key` on `POST /portfolios/:id/transactions` (ADR-008 point 8) | `Planned (B4)`, see §53 |

Open detail (B0): the creation-order tiebreak has no persisted column.
`createdAt` has millisecond precision and rows written in one unit of work
(an import) can share it, and `cuid` is not a strict sequence. A persisted
ordinal or equivalent is needed for a deterministic order.

---

# 10. Transaction Lifecycle

**Status:** `Implemented` (synchronous). Unused enum values noted below.

Enum `TransactionStatus` (`transaction_status`): `DRAFT`, `VALIDATING`,
`PROCESSING`, `COMPLETED`, `FAILED`.

Creation is synchronous (ADR-008 point 12). Within one unit of work the row is
inserted as `DRAFT`, the position is recalculated (§8), and the row is set to
`COMPLETED`. If any step fails the whole unit rolls back, so only `COMPLETED`
rows are ever committed. There is no retry state; a failed request leaves no
row.

`VALIDATING`, `PROCESSING` and `FAILED` exist in the enum but are never
written. Analytics count only `COMPLETED` transactions (ADR-004 point 1,
amended 2026-10-05, `Planned (B1)`). Asynchronous work (CSV import) has its own state model on `Job`
(§52), not on `Transaction`.

Open detail (B0): drop the unused values from `TransactionStatus` or keep
them; either choice leaves ADR-008 unchanged.

---

# 11. Decision

**Status:** `Implemented` — table `decisions`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `portfolioId` | `String` | no | — | FK to `Portfolio`, `onDelete: Cascade`; indexed |
| `assetId` | `String` | no | — | FK to `Asset`, `onDelete: Restrict`; indexed |
| `title` | `String` | no | — | |
| `thesis` | `String` | no | — | |
| `direction` | `DecisionDirection` | no | — | |
| `entryPrice` | `Decimal(18, 8)` | yes | — | |
| `targetPrice` | `Decimal(18, 8)` | yes | — | |
| `stopPrice` | `Decimal(18, 8)` | yes | — | |
| `currency` | `String` | yes | — | shared by the three prices |
| `riskLevel` | `String` | yes | — | open list |
| `createdAt` | `DateTime` | no | `now()` | |
| `closedAt` | `DateTime` | yes | — | |
| `outcome` | `String` | yes | — | open list (free text) |
| `notes` | `String` | yes | — | |

Enum `DecisionDirection` (`decision_direction`): `LONG`, `SHORT`, `NEUTRAL`.

A decision records why a trading action was considered or taken. It is not a
transaction and does not change holdings.

---

# 12. Decision Event

**Status:** `Implemented` — table `decision_events`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `decisionId` | `String` | no | — | FK to `Decision`, `onDelete: Cascade`; indexed |
| `timestamp` | `DateTime` | no | — | real event time; the mapper defaults it to now when omitted |
| `type` | `DecisionEventType` | no | — | closed enum |
| `payload` | `Json` | no | — | shape depends on `type` |

Enum `DecisionEventType` (`decision_event_type`): `DECISION_CREATED`,
`THESIS_RECORDED`, `POSITION_OPENED`, `PRICE_UPDATE`, `RISK_CHANGED`,
`TARGET_REACHED`, `POSITION_ADJUSTED`, `POSITION_CLOSED`, `NOTE_ADDED`.
The list is closed; a new type needs a migration.

Events are immutable once recorded and are read in `timestamp` ascending
order.

## 12.1 Payload conventions

**Status:** `Implemented` for the shapes below; `Planned (B0)` for the value
format (ADR-002 decision point 9).

Decision Replay (`projectDecisionReplay`, `packages/domain`) understands these
shapes. Prices are interpreted in the decision's currency.

- Today: `price` and `quantity` are JSON numbers, read as JavaScript numbers.
- B0: `price` and `quantity` are decimal strings (for example `"150.25"`)
  parsed with `Decimal`. A number or a malformed string is reported as an
  issue.

```text
DECISION_CREATED   {}
THESIS_RECORDED    { thesis? }          falls back to decision.thesis
POSITION_OPENED    { quantity, price }
PRICE_UPDATE       { price }
RISK_CHANGED       { riskLevel }
TARGET_REACHED     { price }
POSITION_ADJUSTED  { quantity, price }  quantity = new total, not a delta
POSITION_CLOSED    { price }
NOTE_ADDED         { note }
```

Malformed or out-of-sequence events do not break the replay: they are ignored
for state purposes and reported as issues.

Open detail (B5): events with equal `timestamp` have no tiebreak
(`BACKEND-ROADMAP.md` §4, "Event ordering tiebreaker beyond `timestamp`").

---

# 13. Decision Replay Model

**Status:** `Implemented` (`packages/domain/src/calculations/decision-replay.ts`)

```text
Decision ── Events[0..currentIndex] (timestamp order) ──► Replay State
```

Replay state is derived and never mutates the decision or its events.

---

# 14. Scenario

**Status:** `Implemented` — table `scenarios`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `portfolioId` | `String` | no | — | FK to `Portfolio`, `onDelete: Cascade`; indexed |
| `name` | `String` | no | — | |
| `description` | `String` | yes | — | |
| `baseSnapshotId` | `String` | yes | — | no foreign key; see below |
| `status` | `ScenarioStatus` | no | `DRAFT` | |
| `changes` | `Json` | no | `[]` | `ScenarioChange[]`, §15 |
| `createdAt` | `DateTime` | no | `now()` | |
| `updatedAt` | `DateTime` | no | `@updatedAt` | |

Enum `ScenarioStatus` (`scenario_status`): `DRAFT`, `SAVED`, `ARCHIVED`.

`baseSnapshotId` references nothing: portfolio snapshots are `Deferred`
(no entity, no ADR). Scenarios are evaluated against the portfolio's current
state.

---

# 15. Scenario Variable

**Status:** `Implemented`

A scenario's variables are part of the `Scenario` entity as
`ScenarioChange[]`, stored in the `changes` JSON column. The only supported
variable is `{ assetId, percentChange }`: a percentage change to that asset's
current price, never below -100%, at most one entry per asset. Other change
kinds (for example allocation changes) are `Deferred`.

`percentChange` stays a JSON number. From B0 it is converted to `Decimal`
before it is applied to a price (ADR-002 decision point 9).

---

# 16. Scenario Result

**Status:** `Implemented` (derived, never persisted)

```text
Current portfolio state + Scenario changes ──► Scenario calculation ──► Scenario Result
```

Calculated by `scenario-impact.ts` and `scenario-comparison.ts`
(`packages/domain/src/calculations`). Results are recalculated on request and
never modify the portfolio.

---

# 17. Watchlist Item

**Status:** `Implemented` — table `watchlist_items`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `userId` | `String` | no | — | FK to `User`, `onDelete: Cascade` |
| `assetId` | `String` | no | — | FK to `Asset`, `onDelete: Cascade` |
| `createdAt` | `DateTime` | no | `now()` | |

Unique: `(userId, assetId)` — a user cannot watch the same asset twice; the
constraint also makes a repeated add detectable. Removing an item never
removes the asset.

---

# 18. Market Price

**Status:** `Implemented` — table `market_prices`. Tick semantics `Planned (B5)`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `assetId` | `String` | no | — | PK and FK to `Asset`, `onDelete: Cascade` |
| `price` | `Decimal(18, 8)` | no | — | current price |
| `currency` | `String` | no | — | shared by the money fields |
| `previousPrice` | `Decimal(18, 8)` | no | — | last closed daily candle |
| `change` | `Decimal(18, 8)` | no | — | `price − previousPrice` |
| `changePercent` | `Float` | no | — | percentage, display value |
| `timestamp` | `DateTime` | no | — | time of `price` |
| `source` | `MarketDataSource` | no | `MOCK` | |

Enum `MarketDataSource` (`market_data_source`): `MOCK`, `EXTERNAL`. All data
today, seed and simulator, is `MOCK`; there is no external provider.

One row per asset. The seed sets `previousPrice` to the previous daily close
(`Implemented`). Under continuous ticking, `previousPrice`, `change` and
`changePercent` are always measured against the last closed daily candle,
never the previous tick, and roll over at each UTC day close (ADR-007 points 8
and 14, `Planned (B5)`).

Open detail (B5): a tick older than the stored `timestamp` must not overwrite
it (§44); the comparison key (`timestamp` or `MarketEvent.sequence`) is not
fixed.

---

# 19. Market Event

**Status:** `Implemented` — table `market_events`. Uniqueness and retention `Planned (B5)`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `assetId` | `String` | no | — | FK to `Asset`, `onDelete: Cascade` |
| `price` | `Decimal(18, 8)` | no | — | |
| `currency` | `String` | no | — | |
| `timestamp` | `DateTime` | no | — | the mapper sets the current time |
| `sequence` | `BigInt` | no | — | per asset |

Index: `(assetId, sequence)`, not unique.

`Planned (B5)` per ADR-007 point 8 and Deferred detail:

- `(assetId, sequence)` becomes unique, so a duplicated tick is rejected;
- after a restart the engine resumes from `MAX(sequence)` per asset;
- retention is bounded (limit fixed in B5).

---

# 20. Historical Price

**Status:** `Implemented` — table `historical_prices`. Simulator candles `Planned (B5)`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `assetId` | `String` | no | — | PK part; FK to `Asset`, `onDelete: Cascade` |
| `timestamp` | `DateTime` | no | — | PK part; the mapper defaults it to now when omitted |
| `currency` | `String` | no | — | shared by OHLC |
| `open` | `Decimal(18, 8)` | no | — | |
| `high` | `Decimal(18, 8)` | no | — | |
| `low` | `Decimal(18, 8)` | no | — | |
| `close` | `Decimal(18, 8)` | no | — | |
| `volume` | `Decimal(24, 8)` | no | — | |

Primary key: `(assetId, timestamp)`, so at most one candle per asset per
timestamp and writes can be idempotent upserts. There is no `id` and no
granularity column: candles are daily by convention.

The seed writes 90 daily candles per asset at `00:00:00Z`, ending on the fixed
date 2026-09-14 (`Implemented`). `Planned (B5)` per ADR-007 point 8: seed
candles end the day before the seed runs (relative dates), the simulator
closes one candle per asset at each UTC day rollover, and on startup it
generates the candles for days the server was offline, so the daily series has
no gaps. ADR-004 builds the portfolio value series from these candles.

Open detail (B5): every writer must use the same candle key (`00:00:00Z` of
the UTC day, as the seed does); a candle keyed at another time of day would
create a second candle for the same day.

---

# 21. Notification

**Status:** `Implemented` — table `notifications`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `userId` | `String` | no | — | FK to `User`, `onDelete: Cascade`; indexed |
| `type` | `String` | no | — | open list |
| `title` | `String` | no | — | |
| `message` | `String` | no | — | |
| `severity` | `NotificationSeverity` | no | `INFO` | |
| `readAt` | `DateTime` | yes | — | `null` means unread |
| `createdAt` | `DateTime` | no | `now()` | |
| `metadata` | `Json` | yes | — | |

Enum `NotificationSeverity` (`notification_severity`): `INFO`, `SUCCESS`,
`WARNING`, `ERROR`.

An alert trigger creates a notification in the same transaction that records
the trigger (ADR-007 point 9 and Deferred detail, `Planned (B5)`).

---

# 22. Alert

**Status:** `Implemented` — table `alerts`. Trigger state `Planned (B5)`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `String` | no | `cuid()` | PK |
| `userId` | `String` | no | — | FK to `User`, `onDelete: Cascade`; indexed |
| `assetId` | `String` | yes | — | FK to `Asset`, `onDelete: Cascade` |
| `portfolioId` | `String` | yes | — | FK to `Portfolio`, `onDelete: Cascade` |
| `type` | `AlertType` | no | — | |
| `condition` | `String` | no | — | open list |
| `threshold` | `Float` | no | — | not `Money`: not every type is a currency amount |
| `enabled` | `Boolean` | no | `true` | |
| `createdAt` | `DateTime` | no | `now()` | |
| `updatedAt` | `DateTime` | no | `@updatedAt` | |

Enum `AlertType` (`alert_type`): `PRICE`, `PORTFOLIO_CHANGE`, `ALLOCATION`,
`VOLATILITY`.

`Planned (B5)` per ADR-007 point 9 and Deferred detail: alerts are
edge-triggered; `armed` and `lastTriggeredAt` are persisted in the same
transaction as the notification, so a restart does not re-fire them;
re-arming uses a hysteresis band or cooldown, and the initial state of an
already-true alert is defined.

Open detail (B5): which of `assetId`/`portfolioId` each `type` requires is not
enforced by the schema; a `PRICE` threshold is a `Float` compared with a
`Decimal` price, so equality at the boundary needs a defined comparison.

---

# 23. User Preferences

**Status:** `Implemented` — table `user_preferences`.

| Field | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `userId` | `String` | no | — | PK and FK to `User`, `onDelete: Cascade` |
| `theme` | `String` | no | `"system"` | `light`, `dark` or `system` only, validated at the API boundary `Planned (B0)` (ADR-002 point 10) |
| `language` | `String` | no | `"en"` | `en` or `es` only, validated at the API boundary `Planned (B0)` (ADR-010 point 8) |
| `defaultPortfolioId` | `String` | yes | — | no foreign key; ownership checked by the service |
| `reducedMotion` | `Boolean` | no | `false` | |
| `notificationPreferences` | `Json` | no | `{}` | |
| `updatedAt` | `DateTime` | no | `@updatedAt` | |

One row per user, created lazily on first write. Preferences never hold
business-critical state.

Open detail (B0): `defaultPortfolioId` has no foreign key, so deleting the
portfolio leaves a dangling value; readers must tolerate it or deletion must
clear it.

---

# 24. Derived Portfolio Metrics

**Status:** `Implemented` (current-state metrics); period analytics `Planned (B1)`.

Current-state metrics are calculated from positions and market prices
(`portfolio-metrics.ts`, `portfolio-daily-change.ts`): `totalValue`,
`investedValue`, `unrealizedPnL`, `unrealizedPnLPercent`, and the daily change
measured against `MarketPrice.previousPrice`.

`Planned (B1)`, defined by ADR-004 and specified in `16-analytics-spec.md`:
realized P/L (ADR-003 point 4), period return (time-weighted), period P/L,
volatility and drawdown, each with `effectiveFrom` when clamped.

There is no `cashValue` metric (ADR-003 point 2). Money values use `Money`;
returns and percentages are computed in `Decimal` and become numbers only in
the presenter (ADR-004 point 14, amended 2026-10-05).

---

# 25. Position Metrics

**Status:** `Implemented` (`packages/domain/src/calculations/position-metrics.ts`)

Derived from a position and its price: `marketValue`, `costBasis`,
`unrealizedPnL`, `unrealizedPnLPercent`. Allocation per position comes from
§26.

---

# 26. Allocation Metrics

**Status:** `Implemented` (`packages/domain/src/calculations/allocation.ts`)

```text
allocation(group) = Σ marketValue(group) ÷ portfolio totalValue
```

Each group carries `key`, `marketValue` and `percentage`. Grouping by asset,
asset type and currency is available; grouping by sector is `Deferred`
(ADR-004 point 13).

Open detail (B1): allocation of an empty portfolio (`totalValue = 0`) is
covered by `16-analytics-spec.md`.

---

# 27. Performance Metrics

**Status:** `Planned (B1)`

ADR-004 points 1-7 define the daily value series, cash flows (every `BUY` an
inflow, every `SELL` an outflow, ADR-003 point 3), daily return, time-weighted
period return, period P/L, periods, insufficient history and missing prices.
Formulas and worked examples live in `16-analytics-spec.md`.

---

# 28. Attribution

**Status:** `Implemented` (current state); range attribution `Planned (B1)`.

Attribution is derived and never stored. Over a range, each asset's
contribution is its value change minus its own flows, and contributions sum
exactly to the period P/L (ADR-004 point 10). No Brinson-style decomposition.

---

# 29. Portfolio Pulse

**Status:** `Implemented` (`portfolio-pulse.ts`); real volatility and drawdown inputs `Planned (B1)`.

A deterministic, explainable classification. Each dimension carries a
`classification`, the underlying `value` and an `explanation`:

| Dimension | Classifications |
| --- | --- |
| Performance | `POSITIVE`, `NEUTRAL`, `NEGATIVE` |
| Concentration | `LOW`, `MODERATE`, `HIGH` |
| Volatility | `LOW`, `MODERATE`, `HIGH`, `UNKNOWN` |
| Drawdown | `LOW`, `MODERATE`, `SEVERE`, `UNKNOWN` |

ADR-004 point 11 replaces the current proxy (largest position) with the
portfolio's real volatility and drawdown. Exposure and liquidity dimensions
are `Deferred`.

---

# 30. Data Relationships

**Status:** `Implemented`

| From | To | Cardinality | `onDelete` |
| --- | --- | --- | --- |
| Credential | User | 0..1 : 1 | Cascade |
| UserPreference | User | 0..1 : 1 | Cascade |
| Portfolio | User | n : 1 | Cascade |
| WatchlistItem | User / Asset | n : 1 | Cascade / Cascade |
| Notification | User | n : 1 | Cascade |
| Alert | User / Asset? / Portfolio? | n : 1 | Cascade on each |
| Transaction | Portfolio / Asset | n : 1 | Cascade / Restrict |
| Position | Portfolio / Asset | n : 1 | Cascade / Restrict |
| Decision | Portfolio / Asset | n : 1 | Cascade / Restrict |
| DecisionEvent | Decision | n : 1 | Cascade |
| Scenario | Portfolio | n : 1 | Cascade |
| MarketPrice | Asset | 0..1 : 1 | Cascade |
| MarketEvent | Asset | n : 1 | Cascade |
| HistoricalPrice | Asset | n : 1 | Cascade |

All foreign keys use `ON UPDATE CASCADE` (Prisma default). `Scenario.baseSnapshotId`
and `UserPreference.defaultPortfolioId` are plain strings without a foreign
key.

---

# 31. Source of Truth Rules

**Status:** `Implemented`

| Data | Source of truth |
| --- | --- |
| User identity | `User` |
| Password | `Credential` |
| Portfolio metadata | `Portfolio` |
| Transaction history | `Transaction` |
| Current holding | `Position`, a projection of `Transaction` (§8) |
| Current asset price | `MarketPrice` |
| Historical price | `HistoricalPrice` |
| Portfolio metrics, allocation, attribution, pulse | Derived |
| Scenario baseline | Current portfolio state (snapshots `Deferred`) |
| Decision history | `DecisionEvent` |

The UI is never the source of truth for domain state.

---

# 32. Derived State Rules

**Status:** `Implemented`

```text
Transaction committed ─► Position updated ─► Portfolio metrics ─► Allocation ─► Attribution ─► Pulse
```

Only the `Position` step is persisted, inside the transaction's unit of work.
Everything after it is recalculated on read, deterministically.

---

# 33. Demo Data Strategy

**Status:** `Implemented` (`packages/database/src/seed`)

The seed is interconnected, not random: one user with credentials, three USD
portfolios (one intentionally empty), assets, transactions with the positions
they produce, market prices, 90 daily candles per asset, decisions with
events, scenarios, notifications and alerts.

Watchlist entries are not seeded.

---

# 34. Demo Data Layers

**Status:** `Deferred` — no ADR decides the demo data layers; behavior is
owned by `12-demo-mode-spec.md`. The demo itself is `Planned (FE)` (ADR-006
point 1).

```text
Seed data (immutable) ─► Session state (demo mutations) ─► Derived state
```

---

# 35. Demo Reset Model

**Status:** `Deferred` — same as §34.

Reset restores the seed and discards session mutations, without requiring
manual storage deletion or developer tools.

---

# 36. Mock Data Realism

**Status:** `Implemented` for the seed (§33); demo-only variations `Deferred`
(§34).

Seed data covers profitable and losing positions, several assets and dates,
`BUY`/`SELL` combinations, and decisions with different outcomes (for example
target reached, stopped out).

---

# 37. Edge Cases

**Status:** `Implemented` for data states the seed covers; demo injection `Deferred` (§34).

Covered by the seed or the schema: empty portfolio (zero positions and
transactions), empty watchlist, missing optional fields (nullable columns),
duplicate watchlist entries (unique constraint). Unavailable market data,
stale market events, duplicate operations and failed mutations are injected
by the demo (`12-demo-mode-spec.md`) or handled in B4/B5 (§19, §53).

---

# 38. Data Validation

**Status:** `Implemented` for entity and transaction rules; see §9.2 for planned rules.

- Entity: identifiers present, required names, valid asset type and enums.
- Transaction: see §9.2.
- Scenario: target portfolio owned by the actor, asset exists, at most one
  change per asset, `percentChange >= -100`.

The database enforces types, nullability, enums, foreign keys and unique
constraints. It does not enforce value ranges (positive quantity, currency
codes); those are domain rules.

---

# 39. Monetary Precision

**Status:** `Implemented`

- The domain represents money with `decimal.js`, wrapped in a `Money` value
  object (amount plus currency); see `04-tech-stack.md` §28.1.
- Persisted money and quantities use `Decimal(18, 8)`: 10 integer digits and
  8 decimal places (1 satoshi). `HistoricalPrice.volume` uses
  `Decimal(24, 8)`.
- On the wire, money is `{ amount: string, currency: string }` (ADR-002).
- `Float` is used only for values that are not authoritative money:
  `MarketPrice.changePercent` and `Alert.threshold`.
- Every money column has a sibling `currency` column shared by the amounts on
  that row. Version 1 is single-currency (ADR-004 point 12).

Open detail (B0): values with more than 8 decimal places are rounded by the
database on write, and products that exceed 10 integer digits fail on write.
Input bounds, and the scale and rounding of computed amounts (ADR-002
Deferred detail), are fixed with the contracts.

---

# 40. Timestamps

**Status:** `Implemented`

- Every `DateTime` is PostgreSQL `TIMESTAMP(3)` without time zone,
  millisecond precision. Prisma writes and reads it as UTC; the column holds
  UTC by convention.
- On the wire, dates are ISO-8601 strings in UTC (ADR-002).
- Day boundaries for analytics, `YTD` and candles are UTC calendar dates,
  including the demo and the simulator clock (ADR-004 Deferred detail,
  `Planned (B1)`).

| Kind | Fields |
| --- | --- |
| Event time | `Transaction.executedAt`, `DecisionEvent.timestamp`, `MarketPrice.timestamp`, `MarketEvent.timestamp`, `HistoricalPrice.timestamp` |
| Creation time | `createdAt` |
| Update time | `updatedAt` (`@updatedAt`) |
| Lifecycle time | `Position.openedAt`, `Decision.closedAt`, `Notification.readAt` |

`createdAt` defaults are set by the database; event times are supplied by the
application, which defaults several to the current time (see each entity).

---

# 41. Identifiers

**Status:** `Implemented`

Primary keys are `cuid()` strings with no business meaning, except where the
key is the relationship itself: `Credential`, `UserPreference` and
`MarketPrice` use the parent id, and `HistoricalPrice` uses
`(assetId, timestamp)`. Business keys are unique constraints:
`User.email`, `Asset.symbol`.

---

# 42. Soft Deletion

**Status:** `Implemented`

There is no soft-delete column. Portfolios are archived through
`status = ARCHIVED` rather than deleted. Assets referenced by history cannot
be deleted (`Restrict`).

`Planned (B0)`: an archived portfolio is read-only. Mutations scoped to it
are rejected with 409 `CONFLICT` (ADR-010 point 5).

---

# 43. Historical Integrity

**Status:** `Implemented`

- A transaction is immutable after creation except for `status` (§9).
- A portfolio's `baseCurrency` cannot change after creation, since it would
  reinterpret every historical amount.
- Decision events are immutable once recorded.
- `HistoricalPrice` candles are never rewritten by ticks (ADR-007).

---

# 44. Event Ordering

**Status:** `Planned (B5)`

Ordering uses `MarketEvent.sequence` (monotonic per asset) and, for decision
events, `timestamp`. Realtime envelopes carry a per-channel `sequence`; on a
gap the client resynchronizes over HTTP (ADR-007 point 5). A stale event never
overwrites a newer value. See §12, §18 and §19 for open details.

---

# 45. Concurrency Considerations

**Status:** `Implemented` (unit of work); remaining cases `Planned` per block.

| Case | Mechanism | Status |
| --- | --- | --- |
| Transaction and its position change | One database transaction (unit of work) | `Implemented` |
| Duplicate watchlist entry | Unique `(userId, assetId)` | `Implemented` |
| Two transactions on one position at once | See §8 Open detail | `Planned (B0)` |
| Duplicate `POST` with the same `Idempotency-Key` | Reservation under a unique constraint (§53) | `Planned (B4)` |
| Job status transitions (resume, cancel, apply) | Compare-and-set on status (§52) | `Planned (B4)` |
| Duplicate market tick | Unique `(assetId, sequence)` (§19) | `Planned (B5)` |
| Demo in-memory unit of work interleaving | ADR-001 Deferred detail | `Planned (B0)` |

---

# 46. Data Ownership

**Status:** `Implemented`

| Domain | Owns |
| --- | --- |
| Auth | `User`, `Credential`, sessions (B2) |
| Portfolio | `Portfolio` lifecycle |
| Transaction | `Transaction`, `Position` projection |
| Analytics | derived metrics (no tables) |
| Market | `MarketPrice`, `MarketEvent`, `HistoricalPrice` |
| Decision | `Decision`, `DecisionEvent` |
| Scenario | `Scenario` |
| Notifications | `Alert`, `Notification` |
| Jobs | `Job`, `IdempotencyKey` (B4) |

Cross-domain access goes through repository ports and use cases.

---

# 47. Serialization Boundaries

**Status:** `Planned (B0)`

Domain objects are not exposed directly as API responses. Responses are DTOs
defined as Zod schemas in `@trading/contracts` (ADR-002); persistence column
names and Prisma types never reach the client.

---

# 48. Demo Mock Contract

**Status:** `Planned (B0)` — ADR-001.

Repositories are ports in `packages/domain`. The real composition root wires
Prisma repositories; the demo wires in-memory repositories behind the same
ports, with the same use cases. The application layer does not know which
implementation is active.

---

# 49. Data Evolution

**Status:** `Deferred`

Brokerage integrations, real market data, multi-currency portfolios (ADR-004
point 12), a cash ledger (ADR-003 point 5), sectors (ADR-004 point 13), tax
analysis and collaboration are out of scope until a new decision.

---

# 50. Data Model Quality Criteria

**Status:** `Implemented`

The model is acceptable when every persisted field in `schema.prisma` appears
here with its exact type, nullability, default, key and `onDelete`; every
planned field cites its ADR and block; derived values name their inputs; and
historical facts are immutable.

---

# 51. Guiding Principle

**Status:** `Implemented`

The data model represents the domain, not the UI, and answers reliably:

```text
What did the trader own?
What happened?
Why did it happen?
What was the result?
What could have happened differently?
```

---

# 52. Job

**Status:** `Planned (B4)` — ADR-008.

A `jobs` table backs the in-process runner (ADR-008 point 4). Required by the
ADR:

| Concern | Requirement |
| --- | --- |
| Type | CSV transaction import (point 1) |
| Owner | the user and the target portfolio, checked for ownership (point 9) |
| Status | `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT` (point 3) |
| Failure reason | `VALIDATION_FAILED`, `INTERRUPTED`, `APPLY_ERROR`, `APPLY_REJECTED`, `PORTFOLIO_ARCHIVED` — the complete set (point 6, amended 2026-10-08) |
| Stage | persisted (validate or apply), used by compare-and-set transitions (Deferred detail) |
| Attempt | incremented on retry (point 6) |
| Progress | `processed`, `total`; a field, not a state (point 3) |
| Input | the CSV content, stored in the row at creation and bounded (points 4 and 10); kept while the job can still be retried and cleared for `COMPLETED` jobs and for jobs that `FAILED` with `VALIDATION_FAILED` or `PORTFOLIO_ARCHIVED` (point 4, amended 2026-10-07 and 2026-10-08) |
| Result | per-row validation report on `VALIDATION_FAILED` (point 2) |
| Timing | queued time per attempt, for the timeout (Deferred detail) |

Invariants: the apply stage writes all rows and sets `COMPLETED` in one
database transaction, conditionally on the expected status (points 2 and 5);
on startup `PROCESSING` jobs become `FAILED` with `INTERRUPTED` and `QUEUED`
jobs resume (point 5).

Open detail (B4): exact columns and indexes, and a persisted row ordinal for
imported transactions (§9.2 Open detail).

---

# 53. Idempotency Key

**Status:** `Planned (B4)` — ADR-008 point 8 and Deferred detail.

An `idempotency_keys` table, independent of jobs. Required by the ADR:

- scoped per user: unique `(userId, key)`, reserved before processing so a
  second in-flight request gets 409;
- a request hash covering method, route, path parameters and body; the same
  key with a different hash returns 409 `CONFLICT`;
- the stored response, written in the same unit of work as the mutation;
  5xx outcomes are not stored;
- a reservation lease, and a 24-hour expiry; expired rows are purged or
  treated as absent.

Used by `POST /portfolios/:id/transactions` and import creation.

---

# 54. Failure-Mode Review

**Status:** `Implemented` (review of the current schema, 2026-10-05)

The checklist in `docs/README.md` applied to the data model. Each item points
to where it is handled.

| Category | Finding | Where |
| --- | --- | --- |
| Concurrency | Position read-modify-write race; idempotency races; job transitions; demo unit of work | §45 |
| Crash and restart | Transaction and position commit together; jobs resume or fail as `INTERRUPTED`; alert state and market sequence survive restart | §10, §52, §22, §19 |
| Timeouts and expiry | Session idle/absolute lifetime; idempotency 24 h and lease; job timeout per attempt | §5.3, §53, §52 |
| Retries and duplicates | Watchlist and position uniqueness; candle primary key; `(assetId, sequence)` uniqueness; `Idempotency-Key` | §17, §8, §20, §19, §53 |
| Boundary math and data edges | `Decimal(18, 8)` range and rounding; same-timestamp ordering; empty portfolio; `SELL` fees above proceeds; backdated projection | §39, §9.2, §12, §26, §8 |
| Partial failure | Unit of work for transactions; all-or-nothing import; notification written with alert trigger | §10, §52, §22 |
