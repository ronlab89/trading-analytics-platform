# SDD 01 — Product Specification

**Project:** Trading Analytics Platform  
**Status:** Draft; all sections reconciled with `02-functional-requirements.md` and the ADRs on 2026-10-05 (task T3.1)  
**Version:** 1.0  
**Depends On:** `00-overview.md`

This document describes the product. The testable contract is
`02-functional-requirements.md`; each section cites its FR IDs instead of
repeating acceptance criteria.

---

## 1. Product Definition

**Status:** `Implemented`

Trading Analytics Platform is a personal trading analysis workspace that
helps independent traders understand:

- the current state of their portfolios;
- what changed over time;
- what contributed to performance;
- how individual decisions evolved;
- how hypothetical scenarios could affect their portfolios.

It does not execute trades or replace a brokerage platform. A portfolio is a
set of holdings with no cash balance (ADR-003). Its value is **analysis,
understanding, and exploration**.

---

# 2. Product Principles

**Status:** `Implemented` (principles); demo parity `Planned (FE)`

### 2.1 Familiar Core

The platform provides the functionality users expect from a portfolio
analytics application, without an unconventional interaction model.

### 2.2 Differentiated Experience

The product is not a visual clone of an existing trading dashboard.
Differentiation comes from:

- information hierarchy;
- contextual interactions;
- analytical workflows;
- decision-oriented features;
- meaningful motion;
- progressive disclosure;
- visual storytelling.

### 2.3 Functional Depth

Every interaction that implies functionality represents a real product
behavior.

### 2.4 Full Demo Parity

The public demo exposes the complete product experience defined here, with
the same business rules (ADR-001). It differs from the full system only in
infrastructure.

```text
                    SAME PRODUCT
                         │
             ┌───────────┴───────────┐
             ↓                       ↓
       Public Demo              Full System
             │                       │
       Mock services            Real services
       Mock data                Database
       Simulated APIs           Real API
       Simulated events         Real-time layer
             │                       │
             └───────────┬───────────┘
                         ↓
                 Same UX / Workflows
```

---

# 3. Product Users

**Status:** `Implemented` (authenticated user, FR-001); roles `Planned (B2)` (ADR-005)

## 3.1 Primary User

**Status:** `Implemented`

### Independent Trader

A user who manages one or more personal portfolios and wants to understand
portfolio behavior, trading decisions, and hypothetical outcomes.

Access is governed by the roles `VIEWER`, `TRADER` and `ADMIN` (ADR-005).
Users come from the seed; registration is out of scope (ADR-005 point 10).

---

# 4. Product Domains

**Status:** per domain, in the sections below

```text
Dashboard
Portfolios
Positions
Transactions
Assets
Watchlist
Analytics
Decision Center
Notifications
Settings
```

Each domain has a clear purpose and does not exist merely to add screens.

---

# 5. Dashboard

**Status:** API `Implemented` (overview, pulse); What Changed `Planned (B1)`; UI `Planned (FE)`

The dashboard is the primary overview of the selected portfolio (FR-004,
FR-005). It answers three questions:

1. **How am I doing?**
2. **What changed?**
3. **What deserves my attention?**

---

## 5.1 Portfolio Overview

**Status:** API `Implemented`; period performance `Planned (B1)`; portfolio selection and UI `Planned (FE)`

The overview shows total value, daily change, performance, allocation,
positions and main contributors of the selected portfolio. See FR-004 and,
for portfolio selection, FR-005.

---

## 5.2 What Changed?

**Status:** `Planned (B1)` (API); UI `Planned (FE)`; threshold-based events `Deferred`

A summary of meaningful changes in the selected period, derived only from
real data. Version 1 reports only events that need no threshold (ADR-010
point 1):

- largest contributor and largest detractor;
- positions opened and closed;
- alerts triggered in the period.

Significant value change, unusual volatility and allocation changes are
`Deferred`. See FR-006.

---

## 5.3 Portfolio Pulse

**Status:** `Implemented`; volatility and drawdown inputs `Planned (B1)`; exposure and liquidity `Deferred`

A deterministic, explainable classification of the portfolio state, with no
external AI service (ADR-004 point 11). Each dimension shows its
classification and the value behind it, so the user understands why.

```text
Performance    Positive
Concentration  Elevated
Volatility     Increasing
Drawdown       Moderate
```

See FR-007 and `16-analytics-spec.md` §15.

---

# 6. Portfolio Management

**Status:** API `Implemented`; read-only archived portfolios `Planned (B0)`; UI `Planned (FE)`

Users can manage multiple portfolios (for example Main, Long-term, Crypto,
Experimental). Each portfolio keeps its own positions, transactions,
performance, allocation, analytics and history. See FR-008.

---

## 6.1 Portfolio Creation

**Status:** API `Implemented`; permission check `Planned (B2)`; UI `Planned (FE)`

Users create a portfolio with its required information. The interface
handles validation errors, conflicts, loading, success, failure and retry.
See FR-009.

---

## 6.2 Portfolio Editing

**Status:** API `Implemented`; UI `Planned (FE)`

Users modify editable portfolio information, with feedback. See FR-010.

---

## 6.3 Portfolio Deletion

**Status:** `Implemented` as archive; read-only archived portfolios `Planned (B0)`; hard deletion and unarchiving `Deferred`; UI `Planned (FE)`

Deleting a portfolio archives it and preserves its history. An archived
portfolio is read-only: any mutation scoped to it is rejected and reads
still succeed (ADR-010 point 5). The action needs explicit confirmation and
can be cancelled. See FR-011.

---

# 7. Positions

**Status:** API `Implemented`; fees in average entry price `Planned (B1)`; live current price `Planned (B5)`; UI `Planned (FE)`

Positions represent the user's current holdings. A position shows asset,
quantity, average entry price, current price, current value, unrealized P/L,
allocation and performance. Realized P/L is reported per `SELL` (ADR-003
point 4). See FR-012.

---

## 7.1 Position Interaction

**Status:** API `Implemented`; composed view `Planned (FE)`

From a position, users reach its transactions, price history and decision
history without losing context. See FR-013.

---

# 8. Transactions

**Status:** `Implemented` (create, list, filter); UI `Planned (FE)`; free-text search `Deferred`

Users register and review portfolio transactions. Version 1 supports `BUY`
and `SELL` only; fees are part of the transaction. There is no cash balance
and no cash validation (ADR-003 points 1-2). `DEPOSIT`, `WITHDRAWAL`,
`DIVIDEND` and `FEE` are future types (ADR-003 point 5).

Listing and filtering: FR-014, FR-016. Search is satisfied by the filters
plus asset search (FR-015, ADR-010 point 2). Validation: FR-018. The data
model is in `05-data-model.md`.

---

## 8.1 Transaction Workflow

**Status:** `Implemented` (validate, persist, recalculate position); `PORTFOLIO_UPDATED` event `Planned (B5)`; UI and demo `Planned (FE)`

```text
Open form
   ↓
Enter data
   ↓
Validate
   ↓
Submit
   ↓
Processing
   ↓
Update portfolio
   ↓
Recalculate analytics
   ↓
Notify user
```

Creation is synchronous and atomic: the transaction and its position are
written in one unit of work, or nothing is (FR-017). The same rules apply in
the public demo (ADR-001).

---

# 9. Assets

**Status:** API `Implemented` (list, search, detail, current price, history); UI `Planned (FE)`; asset volatility, portfolio exposure and related positions in the detail `Deferred`

The asset domain represents the instruments tracked by the platform: symbol,
name, asset class, currency, current price, price change and price history.
Prices are synthetic and produced by the market simulator; the product does
not require real market data (ADR-007). See FR-019, FR-020 and FR-021.

---

# 10. Watchlist

**Status:** API `Implemented` (add, remove); live price updates `Planned (B5)`; UI `Planned (FE)`

Users keep a watchlist of assets: they add and remove assets, see current
simulated prices and price changes, and navigate to asset details. See
FR-022, FR-023 and FR-024.

---

# 11. Analytics

**Status:** allocation `Implemented`; `1D` change `Implemented`; period performance, historical series, portfolio drawdown and volatility `Planned (B1)`; charts `Planned (FE)`; sector allocation, exposure and benchmark comparison `Deferred`

Analytics explain portfolio behavior over a period: time-weighted return and
P/L (FR-025), historical performance (FR-026), allocation (FR-027), drawdown
(FR-028), volatility (FR-029) and contribution (§12). Periods, formulas and
data boundaries are defined by ADR-004 and `16-analytics-spec.md`
(FR-085). Period analytics cover closed days only.

---

# 12. Performance Attribution

**Status:** current-state attribution `Implemented`; range attribution and money contribution per asset `Planned (B1)`; factor breakdown `Deferred` (ADR-004 point 10)

Performance Attribution explains which assets produced a result, instead of
showing only a portfolio total:

```text
Total Performance   + $1,240
BTC                 + $820
ETH                 + $310
AAPL                + $180
```

Version 1 reports the money contribution of each asset (FR-030, FR-031). A
breakdown by factor (price movement, position size, fees, realized results)
is not part of version 1 (ADR-004 point 10).

---

# 13. Decision Center

**Status:** see §14 and §15

The Decision Center groups the product's differentiated analytical
experiences, Decision Replay and Scenario Lab. Both operate on the same
portfolio and market concepts as the rest of the application.

---

# 14. Decision Replay

**Status:** API `Implemented` (list, detail, replay); decision write endpoints `Deferred`; UI `Planned (FE)`

Decision Replay reconstructs the evolution of a trading decision so the user
can navigate its timeline:

```text
Market context → Decision thesis → Entry → Position evolution → Exit → Outcome
```

See FR-032, FR-033 and FR-034. Decisions are read-only in version 1.

---

## 14.1 Replay Interaction

**Status:** replay payload `Implemented`; playback UI `Planned (FE)`

The replay lets the user play, pause, step between events, navigate the
timeline and change playback speed, with market context, position evolution
and decision annotations (FR-034). Animations communicate temporal
progression, not decoration.

---

## 14.2 Expected vs Actual

**Status:** `Deferred` (FR-035)

Comparing expected direction, target and risk with the actual outcome is
parked until scheduled. Its purpose is analytical reflection, not financial
advice.

---

# 15. Scenario Lab

**Status:** API `Implemented` (create, per-asset price change, recalculate value and unrealized P/L, reset, save, compare, delete); UI `Planned (FE)`; other variables and outputs `Deferred`

Scenario Lab lets users apply hypothetical per-asset price changes to a
portfolio and observe the calculated impact without changing the baseline:

```text
Baseline        Scenario
BTC   +8%   →   BTC   -12%
ETH   +4%   →   ETH   +2%
AAPL  +3%   →   AAPL  +5%

Impact: portfolio value, unrealized P/L
```

See FR-036, FR-037 and FR-038. Position size, allocation and exposure
variables, and allocation, risk and exposure outputs, are `Deferred`.

---

## 15.1 Scenario Isolation

**Status:** `Implemented`

Running a scenario never modifies the user's baseline portfolio; it operates
on an isolated state (FR-038).

---

## 15.2 Scenario Comparison

**Status:** API `Implemented`; UI `Planned (FE)`

Users compare a baseline with one or more scenarios, and the comparison
exposes the differences rather than separate charts (FR-042).

---

## 15.3 Scenario Lifecycle

**Status:** create, modify, reset, save, compare, delete `Implemented`; duplicate `Deferred`; UI `Planned (FE)`

See FR-036 to FR-043. Duplicate is parked (FR-041).

---

# 16. Real-Time Experience

**Status:** `Planned (B5)`; client `Planned (FE)`

The platform pushes simulated market updates and the UI updates without a
page refresh (ADR-007). On each price event the client recomputes position
value, unrealized P/L, portfolio value, `1D` change, current allocation and
Portfolio Pulse; committed transactions trigger a refetch; alerts are
evaluated on the server. Period analytics do not change per tick: they
change when a day closes (FR-045). Sessions, subscriptions, connection state
and reconnection: FR-044, FR-046, FR-047 and FR-086.

---

# 17. Market Simulation

**Status:** engine and control `Planned (B5)`; demo controls `Planned (FE)`; demo isolation `Deferred`

A deterministic market simulator (`@trading/market-sim`) reproduces a
real-time system without paid market-data services; the API and the demo
use the same engine (ADR-007). Its modes are defined in
`12-demo-mode-spec.md` §37-§40; controlling it requires `ADMIN`. In real
mode the simulator persists prices and daily candles by design. See FR-048,
FR-049 and FR-050.

---

# 18. Notifications and Alerts

**Status:** notifications API `Implemented` (list, unread filter, mark read, mark all read); alert configuration `Implemented`; alert evaluation and realtime notification events `Planned (B5)`; UI `Planned (FE)`

Notifications correspond to actual application events, never decoration. A
notification is `unread` or `read`; there is no `dismissed` state (ADR-010
point 3). Users configure alerts of type `PRICE`, `PORTFOLIO_CHANGE`,
`ALLOCATION` and `VOLATILITY`; an alert fires when its condition becomes
true, not on every tick, and creates a notification. See FR-051, FR-052 and
FR-053.

---

# 19. States and Feedback

**Status:** API states `Implemented` (empty results, error envelope); UI states `Planned (FE)`; connection states `Planned (B5)`; simulated timeouts and connection loss in the demo `Deferred`

Every major workflow defines its relevant states: loading (FR-057), empty
(FR-058), error and retry (FR-059, FR-075), success (FR-060), confirmation
(FR-061), preserved input after a failure (FR-076) and accessible feedback
(FR-064). Realtime workflows add connection lost and reconnecting (FR-046,
FR-047); permission denied follows FR-084.

In the demo these states come from the real application layer running in
process (ADR-001, ADR-002); scripted request failures, timeouts and
connection loss wait for the frontend-stage demo ADR (FR-071, ADR-010
point 6).

---

# 20. Forms and Validation

**Status:** server-side validation `Implemented`; client-side validation and confirmation dialogs `Planned (FE)`

Forms validate required fields, types, ranges, business constraints and
conflicting values, and confirm destructive actions. The rules are those of
the requirements, not of this document: transaction validation FR-018,
confirmation dialogs FR-061, preserved input FR-076. Client and server use
the same `@trading/contracts` schemas (ADR-002).

---

# 21. Search, Filtering, Sorting, and Navigation

**Status:** asset search, transaction filters and pagination `Implemented`; client-side sorting `Planned (FE)`; server-side sorting and global search `Deferred`; UI `Planned (FE)`

- Search: assets (FR-020); transaction search is covered by filters and
  asset search (FR-015); global search is parked (FR-054).
- Filter: transactions (FR-016) and assets (FR-019).
- Sort: client-side on fully loaded lists only; paginated lists keep the
  API order (FR-055, ADR-010 point 4).
- Paginate: assets and transactions (FR-056); other lists return complete
  results.

The demo runs the same use cases over its seeded data (FR-056, FR-066).

---

# 22. User Experience

**Status:** `Planned (FE)`

The product should feel modern, professional, analytical, focused,
responsive and trustworthy: information-rich without becoming visually
overwhelming, and never a generic admin dashboard. Screens and interaction
rules live in `11-ui-ux-spec.md`.

---

## 22.1 Visual Principles

**Status:** `Planned (FE)`

Strong hierarchy, controlled density, progressive disclosure, clear state
communication, consistent interaction patterns, accessible contrast and
responsive layout. See FR-062 (responsive), FR-063 (keyboard) and FR-079
(consistent feedback).

---

## 22.2 Motion

**Status:** `Planned (FE)`

Motion communicates state changes, hierarchy, navigation, temporal
progression, data updates and feedback, and never blocks usability.
Reduced motion is honored (FR-065).

---

# 23. Public Demo Functional Parity

**Status:** `Planned (FE)`

> **Every user-facing capability whose status is not `Deferred` works in the
> public demo.**

The demo is not a separate mock product. It runs the same application layer
(use cases, domain rules, permission checks) through the in-process
`TradingClient` adapter, and is published as a static build with no backend
calls and no secrets (ADR-001, ADR-002, ADR-006; FR-066, FR-068).

```text
Real:  React -> TradingClient (HTTP) -> API -> application -> PostgreSQL
Demo:  React -> TradingClient (in-process) -> application -> in-memory repositories
```

Details belong to `12-demo-mode-spec.md`.

---

## 23.1 Demo Persistence

**Status:** in-memory persistence within a session `Planned (FE)` (repositories `Planned (B0)`); persistence across reloads `Deferred`

See FR-067. Whether demo data survives a reload is decided in the
frontend-stage demo ADR (ADR-010 point 6; `05-data-model.md` §34).

---

## 23.2 Demo Reset

**Status:** `Deferred`

The demo should offer a reliable way to restore its seeded state (FR-072).
The mechanism is decided in the frontend-stage demo ADR (ADR-010 point 6;
`05-data-model.md` §35).

---

# 24. Data Simulation Principles

**Status:** `Planned (FE)`

Seed data is realistic enough to exercise every non-deferred feature and UI
state: several portfolios and assets, all transaction types, winning and
losing positions, history, varied volatility, decisions, scenarios,
notifications and edge cases. Market data comes from the deterministic
simulator (FR-049). See `05-data-model.md` §33 and §36.

---

# 25. Error Simulation

**Status:** real-rule errors `Planned (FE)`; CSV import failure injection `Planned (FE)`; other scripted failures `Deferred`

- Validation failures and rejected operations (for example an oversell)
  occur in the demo through the real rules, without scripting (FR-071).
- CSV import failures are injectable and produce the job states of FR-081
  (FR-069, ADR-008 point 13).
- Scripted request failures, timeouts, connection loss and simulated
  latency are `Deferred` until the frontend-stage demo ADR (FR-068, FR-071,
  ADR-010 point 6).

---

# 26. Product Boundaries

**Status:** `Implemented` (scope constraint)

The product is not a brokerage, an exchange, a payment platform, an
automated trading system, a financial advisory service or a social trading
network.

---

# 27. Future Product Opportunities

**Status:** `Deferred`

Possible later areas: advanced exposure visualization, market replay, trade
journal intelligence, strategy sandbox, more asset classes, advanced
analytics and AI-assisted analysis. None is built without a new decision,
and none is added only to increase apparent complexity.

---

# 28. Product Success Criteria

**Status:** per criterion, through the referenced requirements

A user can:

1. Understand the current state of a portfolio (FR-004, FR-007).
2. Navigate multiple portfolios (FR-005, FR-008).
3. Manage positions and transactions (FR-012 to FR-018).
4. Explore asset information (FR-019 to FR-021).
5. Analyze portfolio performance (FR-025 to FR-029).
6. Understand what changed (FR-006).
7. Understand why performance changed (FR-030, FR-031).
8. Inspect a trading decision through time (FR-032 to FR-035).
9. Create and compare hypothetical scenarios (FR-036 to FR-043).
10. Experience simulated real-time updates (FR-044, FR-045, FR-070).
11. Recover from realistic error states (FR-059, FR-075, FR-076).
12. Complete workflows with no non-functional primary action (FR-078).

The demo provides each criterion whose requirements are not `Deferred`
(FR-066).

---

# 29. Product Identity

**Status:** `Implemented` (guiding model)

The product communicates three complementary ideas:

### Observe

> **What is happening?**

### Understand

> **Why did it happen?**

### Explore

> **What could happen?**

```text
                 OBSERVE
                    │
                    ▼
              WHAT CHANGED?
                    │
                    ▼
               UNDERSTAND
                    │
          ┌─────────┴─────────┐
          ↓                   ↓
    ATTRIBUTION          DECISION REPLAY
          │                   │
          └─────────┬─────────┘
                    ↓
                 EXPLORE
                    │
                    ▼
              SCENARIO LAB
```

---

# 30. Relationship With Future SDD Documents

**Status:** `Implemented`

This document defines **what the product is**. Exact behavior, quality
attributes, technical design and delivery live in the other SDD documents
(`00`-`16`, including `16-analytics-spec.md`) and in the ADRs (`adr/`);
[`README.md`](README.md) holds the document map and the precedence rule
(ADR > SDD > roadmap > progress). When this document disagrees with an ADR
or with `02-functional-requirements.md`, those win and this document is
corrected.

---

## Product Definition Summary

**Status:** per section above

Trading Analytics Platform is an interactive portfolio analysis workspace
that combines portfolio management with decision-oriented analysis. Its
distinguishing capabilities are:

- **What Changed?** — contextual understanding of portfolio changes.
- **Performance Attribution** — the sources of performance.
- **Decision Replay** — how a trading decision evolved.
- **Portfolio Pulse** — current portfolio conditions.
- **Scenario Lab** — hypothetical outcomes.

The public demo runs the real application layer over simulated
infrastructure and seeded data; the full system is the real engineering
behind it, locally runnable and technically defensible.
