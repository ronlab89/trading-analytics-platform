# Trading Analytics Platform

## SDD — 05. Data Model

**Status:** Draft  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`

---

# 1. Purpose

This document defines the conceptual and logical data model for Trading Analytics Platform.

The model must support:

- portfolio management;
- positions;
- transactions;
- market data;
- analytics;
- trading decisions;
- decision replay;
- scenarios;
- alerts and notifications;
- user preferences;
- demo simulation.

The model must also support the public demo without requiring a real backend or external financial data provider.

---

# 2. Data Modeling Principles

The data model follows these principles:

1. **Single source of truth for primary data.**
2. **Derived values should not be duplicated unnecessarily.**
3. **Relationships must remain internally consistent.**
4. **Business calculations must be reproducible.**
5. **Historical information should be distinguishable from current state.**
6. **Mock data must behave like real application data.**
7. **Demo mutations must affect dependent data consistently.**
8. **The model must allow future persistence without redesigning the domain.**

---

# 3. Domain Overview

The core domain can be represented as:

```text id="1y1hvs"
User
 │
 ├── Portfolios
 │      │
 │      ├── Positions
 │      │      └── Assets
 │      │
 │      ├── Transactions
 │      │      └── Assets
 │      │
 │      ├── Decisions
 │      │      └── Assets
 │      │
 │      └── Scenarios
 │
 ├── Watchlist
 │      └── Assets
 │
 ├── Alerts
 │
 └── Preferences
```

Market data exists as a separate domain source:

```text id="ylf44m"
Market Data
    │
    ├── Assets
    │
    └── Price Events
             │
             ↓
       Portfolio State
             │
             ↓
          Analytics
```

---

# 4. Entity Classification

Entities are divided into four categories.

## 4.1 Primary Entities

Persistent domain objects.

- User
- Portfolio
- Asset
- Position
- Transaction
- Decision
- Scenario

## 4.2 Supporting Entities

Objects that support application behavior.

- WatchlistItem
- Alert
- Notification
- UserPreference

## 4.3 Market Entities

Data originating from market activity.

- MarketPrice
- MarketEvent
- HistoricalPrice

## 4.4 Derived Models

Calculated representations.

- PortfolioMetrics
- PositionMetrics
- PerformanceMetrics
- AllocationMetrics
- Attribution
- DrawdownMetrics
- VolatilityMetrics
- PortfolioPulse
- ScenarioResult

Derived models should not automatically become persisted entities.

---

# 5. User

Represents an authenticated application user.

## Fields

```text id
email
displayName
role
createdAt
updatedAt
```

### Role

Initial roles:

```text
USER
ADMIN
```

Additional roles should only be introduced when required.

---

# 6. Portfolio

Represents a logical collection of trading activity and positions.

## Fields

```text id
userId
name
description
baseCurrency
status
createdAt
updatedAt
```

### Status

```text
ACTIVE
ARCHIVED
```

### Constraints

- A portfolio belongs to one user.
- Portfolio names should follow defined validation rules.
- Archived portfolios should remain available for historical analysis where appropriate.

---

# 7. Asset

Represents a tradable instrument.

## Fields

```text
id
symbol
name
assetType
currency
exchange
status
metadata
```

### Asset types

Initial supported categories may include:

```text
STOCK
ETF
CRYPTO
FOREX
```

The architecture must allow additional asset types later.

### Status

```text
ACTIVE
INACTIVE
```

---

# 8. Position

Represents the current exposure of a portfolio to an asset.

## Fields

```text
id
portfolioId
assetId
quantity
averageEntryPrice
currentPrice
openedAt
updatedAt
```

### Important rule

Position state is derived from transaction history and current market data.

Therefore:

```text
Transactions
     +
Market Price
     ↓
Position State
```

The application should avoid treating manually entered position totals as the authoritative source when they can be calculated.

---

# 9. Transaction

Represents a portfolio operation affecting holdings or cash.

## Fields

```text
id
portfolioId
assetId
type
quantity
price
fees
currency
executedAt
createdAt
```

### Transaction types

Initial types:

```text
BUY
SELL
```

Future types may include:

```text
DIVIDEND
FEE
DEPOSIT
WITHDRAWAL
TRANSFER
```

These should only be introduced when the business model requires them.

---

# 10. Transaction Lifecycle

A transaction should have an explicit lifecycle where asynchronous processing is required.

```text id="t1k2yq"
DRAFT
  ↓
VALIDATING
  ↓
PROCESSING
  ↓
COMPLETED
```

Failure path:

```text id="g5e2g1"
PROCESSING
     ↓
FAILED
     ↓
RETRY
     ↓
PROCESSING
```

Not every transaction implementation must persist every intermediate state.

The UI must nevertheless be able to represent meaningful processing states.

---

# 11. Decision

Represents a trading decision and its contextual reasoning.

## Fields

```text
id
portfolioId
assetId
title
thesis
direction
entryPrice
targetPrice
stopPrice
riskLevel
createdAt
closedAt
outcome
notes
```

### Direction

```text
LONG
SHORT
NEUTRAL
```

### Purpose

The decision entity exists to support the product's analytical and reflective capabilities.

It is not simply another transaction record.

A decision represents:

> **Why a trading action was considered or taken.**

---

# 12. Decision Event

Decision Replay requires a chronological sequence of events.

## Fields

```text
id
decisionId
timestamp
type
payload
```

### Event types

Initial examples:

```text
DECISION_CREATED
THESIS_RECORDED
POSITION_OPENED
PRICE_UPDATE
RISK_CHANGED
TARGET_REACHED
POSITION_ADJUSTED
POSITION_CLOSED
NOTE_ADDED
```

The event model should remain extensible.

---

# 13. Decision Replay Model

Replay state should be derived from ordered events.

```text id="7z0h8j"
Decision
   │
   └── Events[]
          │
          ├── Event 1
          ├── Event 2
          ├── Event 3
          ├── Event 4
          └── Event N
```

At replay time:

```text
Events[0...currentIndex]
          ↓
      Replay State
```

Replay state must not mutate the underlying decision history.

---

# 14. Scenario

Represents an isolated hypothetical modification to a portfolio.

## Fields

```text
id
portfolioId
name
description
baseSnapshotId
status
createdAt
updatedAt
```

### Status

```text
DRAFT
SAVED
ARCHIVED
```

---

# 15. Scenario Variable

A scenario contains modifications relative to a baseline.

Conceptually:

```text id="7f6d0f"
Scenario
   │
   └── Changes
          ├── Asset A → +10%
          ├── Asset B → -5%
          └── Allocation → modified
```

The exact persistence representation should remain implementation-dependent.

The domain should expose meaningful operations rather than leaking storage structure into the UI.

---

# 16. Scenario Result

Scenario results are derived.

## Conceptual structure

```text
Baseline Portfolio
        +
Scenario Changes
        ↓
Scenario Calculation
        ↓
Scenario Result
```

Possible metrics:

```text
portfolioValue
performance
allocation
exposure
drawdown
volatility
risk
```

Scenario results should be recalculable without modifying the baseline portfolio.

---

# 17. Watchlist Item

Represents an asset monitored by the user.

## Fields

```text
id
userId
assetId
createdAt
```

### Constraints

- A user cannot have duplicate entries for the same asset.
- Removing an item must not remove the underlying asset.

---

# 18. Market Price

Represents the current known price of an asset.

## Fields

```text
assetId
price
previousPrice
change
changePercent
timestamp
source
```

### Source

Possible values:

```text
MOCK
EXTERNAL
```

The demo uses:

```text
MOCK
```

---

# 19. Market Event

Represents a price update event.

## Fields

```text
id
assetId
price
timestamp
sequence
```

### Sequence

A monotonically increasing sequence identifier should be available where event ordering matters.

This helps avoid applying stale events.

---

# 20. Historical Price

Represents historical market observations.

## Fields

```text
assetId
timestamp
open
high
low
close
volume
```

The data structure should support charting and historical analysis.

---

# 21. Notification

Represents an application-level user notification.

## Fields

```text
id
userId
type
title
message
severity
readAt
createdAt
metadata
```

### Severity

```text
INFO
SUCCESS
WARNING
ERROR
```

---

# 22. Alert

Represents a condition configured by the user.

## Fields

```text
id
userId
assetId
portfolioId
type
condition
threshold
enabled
createdAt
updatedAt
```

Possible alert types:

```text
PRICE
PORTFOLIO_CHANGE
ALLOCATION
VOLATILITY
```

---

# 23. User Preferences

Represents non-domain application preferences.

## Fields

```text
userId
theme
language
defaultPortfolioId
reducedMotion
notificationPreferences
updatedAt
```

Preferences must not contain business-critical state.

---

# 24. Derived Portfolio Metrics

Portfolio metrics are calculated from primary data.

## Conceptual model

```text
Transactions
Positions
Market Prices
       ↓
Portfolio Metrics
```

Potential fields:

```text
totalValue
cashValue
investedValue
dailyChange
dailyChangePercent
totalReturn
totalReturnPercent
unrealizedPnL
realizedPnL
drawdown
volatility
```

The final metric set will be defined by the analytics specification.

---

# 25. Position Metrics

Derived from:

```text
Position
+
Market Price
```

Potential values:

```text
marketValue
costBasis
unrealizedPnL
unrealizedPnLPercent
allocation
priceChange
priceChangePercent
```

---

# 26. Allocation Metrics

Allocation should be derived from current portfolio state.

Example:

```text id="h6qz3v"
Position Market Value
        ÷
Portfolio Total Value
        =
Asset Allocation
```

The same model can support grouping by:

- asset;
- asset type;
- sector;
- currency.

---

# 27. Performance Metrics

Performance calculations should distinguish between relevant concepts.

At minimum, the domain should be able to distinguish:

- realized P/L;
- unrealized P/L;
- absolute return;
- percentage return.

Additional performance methodologies can be added later.

---

# 28. Attribution

Attribution represents the contribution of components to portfolio performance.

Conceptually:

```text id="2t8c1r"
Portfolio Performance
        │
        ├── Asset A contribution
        ├── Asset B contribution
        ├── Asset C contribution
        └── Other factors
```

Attribution is derived data.

It should not be manually duplicated across multiple entities.

---

# 29. Portfolio Pulse

Portfolio Pulse is a deterministic interpretation of portfolio state.

It should be calculated from measurable signals.

Potential dimensions:

```text
Performance
Concentration
Volatility
Drawdown
Exposure
Liquidity
```

Example conceptual result:

```text
Portfolio Pulse
────────────────
Performance     Healthy
Concentration   Elevated
Volatility      Moderate
Drawdown        Low
Exposure        Balanced
```

The system should retain the underlying values that produced the classification.

The classification must be explainable.

---

# 30. Data Relationships

Core relationships:

```text
User
 │
 ├───────────────┐
 ↓               ↓
Portfolio      Watchlist
 │               │
 ├── Position    └── Asset
 │
 ├── Transaction
 │       │
 │       └── Asset
 │
 ├── Decision
 │       │
 │       └── Decision Events
 │
 └── Scenario
```

Market relationship:

```text
Asset
 │
 ├── Current Price
 │
 └── Historical Prices
```

---

# 31. Source of Truth Rules

The following rules define authoritative data.

| Data                | Source of Truth                          |
| ------------------- | ---------------------------------------- |
| User identity       | User                                     |
| Portfolio metadata  | Portfolio                                |
| Transaction history | Transaction                              |
| Current position    | Derived from transactions + market state |
| Current asset price | Market Price                             |
| Historical price    | Historical Price                         |
| Portfolio metrics   | Derived                                  |
| Allocation          | Derived                                  |
| Attribution         | Derived                                  |
| Portfolio Pulse     | Derived                                  |
| Scenario baseline   | Portfolio snapshot/reference             |
| Decision history    | Decision Events                          |

The UI must not become the source of truth for domain state.

---

# 32. Derived State Rules

Derived values should be recalculated from authoritative inputs.

Example:

```text id="q6n0m1"
Transaction added
      ↓
Position state changes
      ↓
Portfolio metrics change
      ↓
Allocation changes
      ↓
Attribution changes
      ↓
Portfolio Pulse may change
```

This chain should remain deterministic.

---

# 33. Demo Data Strategy

The demo requires a seeded dataset.

The seed should contain:

- multiple portfolios;
- multiple assets;
- positions;
- realistic transaction history;
- historical prices;
- decisions;
- decision events;
- scenarios;
- watchlist entries;
- notifications;
- alert configurations.

The dataset must be interconnected.

Randomly generated unrelated records are not acceptable.

---

# 34. Demo Data Layers

The demo should distinguish three data layers.

## Layer 1 — Seed Data

Immutable baseline data used to initialize the demo.

```text
seed/
```

## Layer 2 — Session State

Mutable state created during the current demo session.

Examples:

- newly created portfolio;
- added transaction;
- changed watchlist;
- saved scenario.

## Layer 3 — Derived State

Calculated from current session state.

Examples:

- portfolio metrics;
- position metrics;
- analytics;
- pulse;
- attribution.

Conceptually:

```text id="sq2l8m"
Seed Data
    ↓
Session State
    ↓
Derived State
```

---

# 35. Demo Reset Model

Resetting the demo should restore:

```text
Seed Data
```

and discard session mutations.

The reset mechanism should be accessible without requiring:

- manual localStorage deletion;
- browser developer tools;
- application reinstall.

---

# 36. Mock Data Realism

Mock data must contain meaningful variation.

Examples:

### Portfolio performance

- strong positive;
- moderate positive;
- flat;
- moderate negative;
- significant drawdown.

### Positions

- profitable;
- losing;
- concentrated;
- diversified;
- small;
- large.

### Transactions

- multiple assets;
- different dates;
- different quantities;
- buy/sell combinations.

### Decisions

- successful;
- unsuccessful;
- partially successful;
- abandoned;
- incomplete.

---

# 37. Edge Cases

The dataset and mock infrastructure must support:

- zero positions;
- zero transactions;
- empty watchlist;
- no decision history;
- missing optional metadata;
- negative performance;
- zero performance;
- extreme allocation;
- large transaction history;
- deleted portfolio;
- unavailable market data;
- stale market events;
- duplicate operations;
- failed mutations.

---

# 38. Data Validation

Validation should occur at appropriate boundaries.

### Entity validation

Examples:

- valid identifiers;
- required names;
- valid currency;
- valid asset type.

### Transaction validation

Examples:

- quantity > 0;
- price > 0;
- valid transaction type;
- valid portfolio;
- valid asset;
- valid date.

### Scenario validation

Examples:

- valid target portfolio;
- valid asset;
- valid modification;
- valid numeric range.

---

# 39. Monetary Precision

Financial values must not rely on unsafe floating-point assumptions for
authoritative calculations.

**Decision:** the domain layer represents monetary and precision-
sensitive values using `decimal.js` (see `04-tech-stack.md` §28.1),
wrapped in a `Money` value object that pairs a decimal amount with a
currency code. Primitive `number` remains acceptable only for values
that do not participate in authoritative financial calculations.

---

# 40. Timestamps

Domain timestamps should be stored in a consistent format.

The system should distinguish:

- event time;
- creation time;
- update time;
- execution time.

Timezone handling must be explicit.

---

# 41. Identifiers

All primary domain entities should use stable unique identifiers.

Identifiers should not encode business meaning.

Example:

```text
portfolio_123
```

is preferable to:

```text
portfolio_user_stock_2026
```

Business meaning belongs in domain fields, not identifiers.

---

# 42. Soft Deletion

Soft deletion should only be introduced when historical integrity or auditing requires it.

It must not become a default pattern for every entity.

For entities where historical references matter, archival states may be preferable to destructive deletion.

---

# 43. Historical Integrity

Historical records should remain interpretable after current state changes.

For example:

A transaction recorded at `$100` must not change simply because the current market price becomes `$120`.

Historical facts and current state must remain separate.

---

# 44. Event Ordering

For event-driven or real-time flows, event ordering must be deterministic.

The system should use:

- timestamps;
- sequence identifiers;
- or equivalent ordering mechanisms.

Stale market events must not overwrite newer known values.

---

# 45. Concurrency Considerations

The complete system must account for concurrent updates.

Examples:

```text
User A updates portfolio
User B updates related data
Market event arrives
```

The architecture must define how conflicting updates are resolved.

The demo does not need to reproduce real multi-user concurrency but should preserve the same domain assumptions.

---

# 46. Data Ownership

Each domain should have clear ownership.

Example:

```text
Portfolio domain
    owns portfolio lifecycle

Transaction domain
    owns transaction lifecycle

Analytics domain
    owns metric calculation

Market domain
    owns market state

Decision domain
    owns decision history

Scenario domain
    owns hypothetical state
```

Cross-domain access should occur through explicit contracts.

---

# 47. Serialization Boundaries

Domain objects should not automatically be exposed directly as API responses.

API contracts may expose purpose-specific DTOs.

Conceptually:

```text
Domain Model
     ↓
Application Service
     ↓
DTO / Response Model
     ↓
Client
```

This prevents storage and domain implementation details from leaking into the public API.

---

# 48. Demo Mock Contract

Mock repositories/services should expose the same conceptual operations as their real counterparts.

Example:

```text id="0o7gsc"
PortfolioRepository

getAll()
getById()
create()
update()
delete()
```

The demo implementation can use:

```text
In-memory state
+
Seed data
+
Simulated latency
+
Failure injection
```

while the real implementation can use:

```text
HTTP/API
+
Database
```

The application layer should not need to know which implementation is active.

---

# 49. Data Evolution

The model must allow future additions without unnecessarily breaking existing contracts.

Potential future domains:

- brokerage integrations;
- real market data;
- AI-assisted analysis;
- advanced risk models;
- multi-currency portfolios;
- tax analysis;
- collaboration.

These are future extensions and should not drive unnecessary complexity in the initial model.

---

# 50. Data Model Quality Criteria

The model is considered acceptable when:

- primary entities have clear ownership;
- relationships are explicit;
- derived values have defined origins;
- historical data remains immutable where appropriate;
- demo data is internally consistent;
- mutations propagate through dependent state;
- mock and real implementations can share contracts;
- monetary precision is handled appropriately;
- timestamps are unambiguous;
- domain boundaries are clear;
- future evolution is possible without premature complexity.

---

# 51. Guiding Principle

The data model should represent the product's domain rather than the UI.

The UI may change.

The API may change.

The persistence technology may change.

But the core relationships should remain understandable:

```text
What did the trader own?
What happened?
What changed?
Why did it change?
What was the result?
What could have happened differently?
```

The data model exists to make those questions answerable reliably.
