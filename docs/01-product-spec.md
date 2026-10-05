# SDD 01 — Product Specification

**Project:** Trading Analytics Platform  
**Status:** Draft; §1-§8 reconciled with `02-functional-requirements.md` and the ADRs on 2026-10-05 (task T3.1)  
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

The asset domain represents instruments tracked by the platform.

An asset may contain:

- symbol;
- name;
- asset class;
- currency;
- current price;
- price change;
- historical data;
- volatility;
- relevant portfolio exposure.

The product does not require real market data for the public demo.

---

# 10. Watchlist

Users can maintain a watchlist of assets.

The watchlist should support:

- adding assets;
- removing assets;
- viewing current mock prices;
- viewing price changes;
- navigating to asset details.

Updates may be simulated in real time.

---

# 11. Analytics

Analytics provide deeper insight into portfolio behavior.

The initial analytics domain should include:

- portfolio performance;
- historical performance;
- allocation;
- P/L;
- drawdown;
- volatility;
- exposure;
- contribution;
- comparison.

The exact calculations and formulas will be defined in later specifications.

---

# 12. Performance Attribution

Performance Attribution explains how portfolio performance was produced.

Instead of presenting only:

```text
Portfolio
+ $1,240
```

the system should allow the user to understand the contributing factors.

Example:

```text
Total Performance
+ $1,240

BTC
+ $820

ETH
+ $310

AAPL
+ $180

Fees
- $70
```

The attribution system should support progressive exploration into the factors contributing to a result.

This capability may be reused by:

- Dashboard;
- Portfolio Analytics;
- Decision Replay;
- Scenario Lab;
- What Changed?

---

# 13. Decision Center

The Decision Center contains the product's primary differentiated analytical experiences.

It consists initially of:

- Decision Replay;
- Scenario Lab.

These experiences should operate on the same underlying portfolio and market concepts used by the rest of the application.

---

# 14. Decision Replay

Decision Replay allows users to reconstruct and inspect the evolution of a trading decision.

A decision may contain:

```text
Market context
      ↓
Decision thesis
      ↓
Entry
      ↓
Position evolution
      ↓
Exit
      ↓
Outcome
```

The user should be able to navigate through the decision timeline.

---

## 14.1 Replay Interaction

The replay experience may provide:

- play;
- pause;
- previous event;
- next event;
- timeline navigation;
- playback speed;
- contextual market information;
- position evolution;
- decision annotations.

Animations and transitions should communicate temporal progression rather than exist purely as decoration.

---

## 14.2 Expected vs Actual

Where sufficient data exists, the replay should distinguish between:

```text
Expected
vs
Actual
```

This may include:

- expected direction;
- expected target;
- expected risk;
- actual movement;
- actual outcome.

The purpose is analytical reflection rather than financial advice.

---

# 15. Scenario Lab

Scenario Lab allows users to explore hypothetical changes to their portfolio.

The user should be able to modify selected variables and observe their calculated impact without changing the baseline portfolio.

Example:

```text
Baseline

BTC    +8%
ETH    +4%
AAPL   +3%

        ↓

Scenario

BTC    -12%
ETH    +2%
AAPL   +5%

        ↓

Impact

Portfolio Value
Risk
Allocation
Performance
```

---

## 15.1 Scenario Isolation

Running a scenario must not modify the user's baseline portfolio.

The scenario should operate against an isolated state.

---

## 15.2 Scenario Comparison

Users should be able to compare:

```text
Baseline
vs
Scenario A
vs
Scenario B
```

The comparison should expose meaningful differences rather than only displaying separate charts.

---

## 15.3 Scenario Lifecycle

The system should support, where appropriate:

- create;
- modify;
- reset;
- save;
- duplicate;
- compare;
- delete.

The final supported lifecycle will be defined by the functional requirements.

---

# 16. Real-Time Experience

Real-time behavior is an important product capability.

The platform should support simulated market updates.

For example:

```text
BTC
112,450.20
      ↓
112,451.80
      ↓
112,449.60
      ↓
112,453.10
```

Updates may affect:

- asset prices;
- positions;
- portfolio value;
- P/L;
- charts;
- analytics;
- portfolio pulse;
- relevant alerts.

The UI should update without requiring a page refresh.

---

# 17. Market Simulation

The public demo should include a market simulation engine capable of producing deterministic or controlled market activity.

Possible modes:

- normal activity;
- high activity;
- market spike;
- market decline;
- connection interruption.

The exact simulation architecture will be defined later.

The simulator exists to reproduce the behavior of a real-time system without requiring paid market-data services.

---

# 18. Notifications and Alerts

The platform should provide meaningful feedback to users.

Notification types may include:

- transaction completed;
- transaction failed;
- scenario completed;
- significant portfolio change;
- simulated market event;
- validation issue;
- connection issue;
- background process status.

Notifications should not become generic UI decoration.

They must correspond to actual application events.

---

# 19. States and Feedback

Every major user workflow must define its relevant states.

At minimum:

```text
Initial
Loading
Success
Empty
Validation Error
Operation Error
Retry
Disabled
Processing
Completed
```

Where relevant, the system should also support:

```text
Connection Lost
Reconnecting
Permission Denied
Timeout
Partial Data
```

The public demo must implement these states through simulated behavior where real infrastructure is unavailable.

---

# 20. Forms and Validation

Forms must provide meaningful client-side validation.

Where applicable, validation should include:

- required fields;
- data types;
- valid ranges;
- business constraints;
- conflicting values;
- destructive-action confirmation.

The final validation rules will be specified in `02-functional-requirements.md`.

---

# 21. Search, Filtering, Sorting, and Navigation

Where datasets justify it, users should be able to:

- search;
- filter;
- sort;
- paginate;
- reset filters;
- preserve relevant context.

These interactions must operate against the mock dataset in the public demo exactly as they would against the real application data.

---

# 22. User Experience

The product should feel:

- modern;
- professional;
- analytical;
- focused;
- responsive;
- trustworthy;
- information-rich without becoming visually overwhelming.

The interface should avoid the appearance of a generic admin dashboard.

---

## 22.1 Visual Principles

The visual design should prioritize:

- strong hierarchy;
- controlled information density;
- contextual detail;
- progressive disclosure;
- purposeful motion;
- clear state communication;
- consistent interaction patterns;
- accessible contrast;
- responsive behavior.

---

## 22.2 Motion

Animations and transitions should communicate:

- state changes;
- hierarchy;
- navigation;
- temporal progression;
- data updates;
- feedback.

Motion should not significantly interfere with usability or accessibility.

---

# 23. Public Demo Functional Parity

The following principle is mandatory:

> **If a capability is part of the product specification, the public demo should provide a functional representation of that capability unless explicitly classified as infrastructure-only.**

For example:

### Real Application

```text
React
   ↓
API
   ↓
Backend
   ↓
Database
```

### Public Demo

```text
React
   ↓
Mock API / Repository
   ↓
In-memory persistence
```

From the user's perspective, both should support equivalent workflows.

---

## 23.1 Demo Persistence

The demo may use:

- in-memory state;
- browser storage;
- seeded mock repositories;
- deterministic mock services.

The persistence strategy must be selected later.

The demo should behave as though the user were interacting with a persistent application wherever practical.

---

## 23.2 Demo Reset

Because the demo uses simulated persistence, it should provide a reliable way to restore the initial seeded state.

This may be:

- automatic reset;
- explicit reset;
- session reset;
- demo environment reset.

The final behavior will be specified later.

---

# 24. Data Simulation Principles

Mock data must be realistic enough to support the full product.

The dataset should include:

- multiple portfolios;
- multiple assets;
- different transaction types;
- profitable positions;
- losing positions;
- historical data;
- different volatility conditions;
- decision histories;
- scenarios;
- notifications;
- edge cases.

The dataset should intentionally include data that allows all relevant UI states and analytical features to be demonstrated.

---

# 25. Error Simulation

The public demo must be capable of reproducing realistic failures.

Examples:

```text
Validation failure
Server error
Timeout
Connection failure
Empty dataset
Rejected operation
Failed background task
Temporary unavailable service
```

These scenarios may be triggered:

- naturally through predefined conditions;
- through a demo control;
- through specific test data.

The final mechanism will be defined in `12-demo-mode-spec.md`.

---

# 26. Product Boundaries

The product must not evolve into:

- a brokerage;
- an exchange;
- a payment platform;
- an automated trading system;
- a financial advisory service;
- a social trading network.

These boundaries are important both for scope control and product identity.

---

# 27. Future Product Opportunities

The architecture should leave room for future capabilities without requiring them in the initial implementation.

Potential future areas include:

- advanced exposure visualization;
- market replay;
- trade journal intelligence;
- strategy sandbox;
- additional asset classes;
- advanced analytics;
- observability;
- AI-assisted analysis.

These features must not be implemented solely to increase the apparent complexity of the portfolio project.

---

# 28. Product Success Criteria

The product succeeds when a user can:

1. Understand the current state of a portfolio.
2. Navigate through multiple portfolios.
3. Manage positions and transactions.
4. Explore asset information.
5. Analyze portfolio performance.
6. Understand what changed.
7. Understand why performance changed.
8. Inspect a trading decision through time.
9. Create and compare hypothetical scenarios.
10. Experience simulated real-time updates.
11. Encounter and recover from realistic error states.
12. Complete workflows without encountering non-functional primary interactions.

The public demo must provide all of these experiences using mock infrastructure.

---

# 29. Product Identity

The product should ultimately communicate three complementary ideas:

### Observe

> **What is happening?**

### Understand

> **Why did it happen?**

### Explore

> **What could happen?**

These principles connect the conventional portfolio-management functionality with the project's differentiated features.

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

This conceptual model should guide future product and UX decisions.

---

# 30. Relationship With Future SDD Documents

This document defines **what the product is**.

The following documents will define progressively:

```text
02-functional-requirements.md
    ↓
Exact system behavior

03-non-functional-requirements.md
    ↓
Quality attributes and measurable constraints

04-tech-stack.md
    ↓
Detailed user journeys

05-data-model.md
    ↓
System architecture and boundaries

06-architecture.md
    ↓
Domain entities and relationships

07-api-spec.md
    ↓
Backend contracts

08-realtime-spec.md
    ↓
Frontend structure and state strategy


09-security-spec.md
    ↓
Security model

10-testing-strategy.md
    ↓
Performance strategy and measurements

11-ui-ux-spec.md
    ↓
Testing approach

12-demo-mode-spec.md
    ↓
Complete public demo behavior

13-observability-spec.md
    ↓
Infrastructure and deployment

14-deployment-spec.mdmd
    ↓

15-implementation-plan.md
    ↓
Implementation sequence
```

No implementation-specific decision in this document should be treated as final if it belongs to one of those later specifications.

---

## Product Definition Summary

Trading Analytics Platform is a **fully interactive portfolio analysis workspace** combining familiar portfolio-management capabilities with decision-oriented analytical experiences.

Its distinguishing capabilities are:

- **What Changed?** — contextual understanding of portfolio changes.
- **Performance Attribution** — understanding the sources of performance.
- **Decision Replay** — reconstructing the evolution of trading decisions.
- **Portfolio Pulse** — interpreting current portfolio conditions.
- **Scenario Lab** — exploring hypothetical outcomes.

The public demo must reproduce the complete product experience using simulated infrastructure and realistic mock data.

The complete implementation must provide the real engineering system behind that experience and remain locally demonstrable and technically defensible.