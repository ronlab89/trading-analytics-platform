# SDD 00 — Project Overview

**Project:** Trading Analytics Platform  
**Status:** Reconciled with the repository and ADR-001 to ADR-009 on 2026-10-05  
**Version:** 2.0  
**Project Type:** Personal Engineering Project  
**Primary Goal:** Portfolio project and technical demonstration

---

## 1. Project Overview

**Status:** backend foundation `Implemented`; web app and public demo `Planned (FE)`.

Trading Analytics Platform is a portfolio analytics system for independent
traders: portfolios, holdings, transactions, market data, performance and
alerts in one place. It is a software engineering case study: architecture,
domain modeling, correctness of financial calculations, security, realtime
handling and testing matter more than feature count.

The same product has two targets (ADR-006 point 1):

1. **Local full stack.** A production-like Node API, PostgreSQL and the web
   app, run locally for demonstrations.
2. **Public demo.** A static build of `apps/web` in demo mode. It runs the
   same application layer in the browser on in-memory infrastructure and
   calls no backend (ADR-001, ADR-002 point 5, ADR-006 point 7).

Current state: development is backend-first. The REST API foundation exists
(`apps/api`, `packages/domain`, `packages/database`); backend work continues
in blocks B0-B7 (`BACKEND-ROADMAP.md`). `apps/web` holds only a wireframe; the
frontend stage follows the backend blocks.

---

## 2. Project Objectives

### 2.1 Demonstrate Software Engineering Skills

**Status:** backend `Implemented` and `Planned (B0-B7)`; frontend `Planned (FE)`.

The repository must give evidence of: system and API design, domain
modeling, authentication and authorization, validation, error handling,
asynchronous processing (CSV import jobs, ADR-008), realtime state
(ADR-007), testing, security practices and developer experience.

### 2.2 Provide a High-Quality Public Demonstration

**Status:** `Planned (FE)` — ADR-006 points 1 and 7.

Visitors use the demo without an account, paid services, API keys, a
backend or a database. A controlled demo identity with a role selector
replaces login (ADR-005 point 11).

### 2.3 Provide a Defensible Technical Implementation

**Status:** `Implemented`

The full stack runs locally, is inspectable in the repository, is tested,
and every significant decision is recorded with its reason and trade-offs in
an ADR (`adr/README.md`).

### 2.4 Maintain Zero Recurring Infrastructure Cost

**Status:** `Implemented`

> **$0 recurring infrastructure cost.**

No paid API, database, hosting, identity provider or monitoring service is
required. There is no hosted backend (ADR-006 point 2).

---

## 3. Product Vision

**Status:** see the per-domain status in §5.1.

A trader can manage portfolios, record `BUY` and `SELL` transactions,
review holdings, follow simulated market prices, analyze performance and
risk, record trading decisions and what-if scenarios, and receive alerts and
notifications, all in one coherent product.

> **Complex software can remain understandable when its architecture, state, workflows, and user feedback are deliberately designed.**

---

## 4. Target User

**Status:** `Implemented`

> **An independent trader managing one or more investment portfolios.**

The product is not a brokerage or an institutional trading terminal. Users
come from the seed; roles are `VIEWER`, `TRADER` and `ADMIN` (ADR-005,
`Planned (B2)`; the schema has `USER` and `ADMIN` today).

---

## 5. Project Scope

### 5.1 Core Scope

**Status:** per domain, below. Requirements are in `01-product-spec.md` and
`02-functional-requirements.md`.

| Domain | Status | Decision |
| --- | --- | --- |
| Login, `GET /auth/me`, Bearer JWT | `Implemented` | ADR-005 point 12 |
| Sessions with refresh tokens, roles and permissions | `Planned (B2)`; permission checks `Planned (B0)` | ADR-005 |
| Portfolios, assets, positions, transactions (`BUY`, `SELL`) | `Implemented` | ADR-003 |
| Chronological transaction validation | `Planned (B0)` | ADR-003 point 6 |
| Market data reads, watchlist, alerts, notifications, preferences | `Implemented` | — |
| Decisions and replay, scenarios | `Implemented` | — |
| Overview (dashboard data) | `Implemented` | — |
| Performance and risk analytics (TWR, P/L, drawdown, volatility, attribution, Pulse) | `Planned (B1)` | ADR-004, `16-analytics-spec.md` |
| Structured logging | `Planned (B3)` | ADR-009 |
| CSV transaction import (background jobs) and idempotency | `Planned (B4)` | ADR-008 |
| Realtime prices and events, shared market simulator | `Planned (B5)` | ADR-007 |
| Generated OpenAPI document | `Planned (B6)` | ADR-002 point 7 |
| Production-like containerized local run | `Planned (B7)` | ADR-006 |
| Web app, dashboard UI, charts, public demo | `Planned (FE)` | ADR-001, ADR-002, ADR-006 |

### 5.2 Explicitly Out of Scope

**Status:** `Deferred`

The project is not a brokerage or execution platform. Out of scope:

- Real-money trading and real order execution.
- Deposits or withdrawals, dividends, fees as transactions, and a cash
  balance: a portfolio holds assets only (ADR-003 points 2 and 5).
- Brokerage accounts, payments and custody of assets.
- Regulatory compliance and financial advice.
- External or guaranteed real-time market feeds: prices are simulated
  (ADR-007).
- Multiple currencies inside one portfolio (ADR-004 point 12).
- Self-registration (ADR-005 point 10).
- A publicly hosted backend (ADR-006 point 2).

Anything that could look like a real financial transaction stays clearly
simulated.

---

## 6. Public Demo Strategy

**Status:** `Planned (FE)`

The demo is a working product, not a mockup, prototype or screenshot set.
Behavior is specified in `12-demo-mode-spec.md`.

### 6.1 Functional Requirement of the Demo

**Status:** `Planned (FE)`

Primary workflows behave as in the full stack: navigation, forms,
validation, loading, empty, error and success states, confirmations,
filtering, sorting, pagination, simulated background processing, realtime
updates, connection states and role-dependent behavior.

### 6.2 Mocked Infrastructure

**Status:** `Planned (B0)` for in-memory repositories; demo wiring `Planned (FE)`; demo data layers and reset `Deferred`.

The demo composes `@trading/application` with in-memory implementations of
the same repository contracts (ADR-001 point 4). The UI reads DTOs through
the `TradingClient` in-process adapter and the same presenters as the API
(ADR-002 point 5), so it cannot tell which mode it runs in. Logging uses a
browser-console adapter (ADR-009 point 1). No network-level API mock is used.

### 6.3 Deterministic Demo Behavior

**Status:** seeded simulator `Planned (B5)`; CSV import failure injection `Planned (FE)`; other failure scenarios `Deferred`.

The simulator is deterministic for a given seed (ADR-007 point 7). The demo's
CSV import has simulated progress and injectable failures (ADR-008 point
13). Other scripted failure scenarios are not decided (`06-architecture.md`
§16).

### 6.4 Simulated Real-Time Data

**Status:** `Planned (B5)` for the engine; demo adapter `Planned (FE)`.

```text
@trading/market-sim (seeded, in the browser)
       ↓
In-process realtime adapter (same client port as the WebSocket adapter)
       ↓
Client state → affected UI
```

The goal is to handle frequent state updates correctly, not to provide
accurate market prices (ADR-007 points 7 and 13).

---

## 7. Complete Application

**Status:** `Implemented` for the API foundation; later parts as listed.

Runs locally only (ADR-006 point 1):

- REST API on Express with request validation, authentication, ownership
  checks, rate limiting, request IDs and health endpoints. `Implemented`
- Domain logic in `@trading/domain`; persistence with Prisma on PostgreSQL in
  `@trading/database`. `Implemented`
- PostgreSQL in Docker Compose for development. `Implemented`
- Application layer and shared contracts. `Planned (B0)`
- Background jobs in process. `Planned (B4)`
- WebSocket realtime. `Planned (B5)`
- API container and `full` Compose profile. `Planned (B7)`
- Web app in real mode. `Planned (FE)`

The stack is in `04-tech-stack.md`; the structure in `06-architecture.md`.

---

## 8. Demo and Full System Relationship

**Status:** `Planned (B0)` for the shared application layer; `Planned (FE)` for the web adapters.

Demo and full stack share one product model and one application layer;
only the infrastructure behind the ports changes (ADR-001, ADR-002).

```text
                      Web UI
                         │
                 TradingClient port
                   /            \
         HTTP adapter        In-process adapter
              │                    │
          Express API              │
              │                    │
         @trading/application ─────┘
              │
     Repository contracts (@trading/domain)
          /               \
  Prisma + PostgreSQL    In-memory (demo)
```

---

## 9. External Services and APIs

**Status:** `Implemented` (none used); any external provider `Deferred`.

No external service is required. A future provider would sit behind a port,
with fallback to the simulator, and needs a new decision
(`04-tech-stack.md` §47-48).

---

## 10. Cost Constraints

**Status:** `Implemented`

Required: no mandatory paid API, database, hosting, identity provider or
monitoring service, and no unavoidable recurring cost.

Chosen: static hosting for the demo (`Planned (FE)`, ADR-006 point 7) and
Docker for local infrastructure. Priorities, in order: reliability,
maintainability, learning value, zero cost.

---

## 11. Engineering Principles

**Status:** `Implemented` for the backend; frontend parts `Planned (FE)`.

### 11.1 Simplicity Before Complexity

No microservices, external queues or brokers without a defined problem: jobs
run in process on a PostgreSQL table (ADR-008 point 4).

### 11.2 Explicit Boundaries

UI, application, domain, infrastructure and persistence stay separated. The
domain is framework-free; boundaries are enforced by workspace
dependencies today and by lint rules from B0 (ADR-001 point 1).

### 11.3 Type Safety

Strict TypeScript everywhere. Request contracts are Zod schemas today;
request and response contracts move to `@trading/contracts` in B0
(ADR-002).

### 11.4 Predictable State Management

Server, client, form and realtime state have distinct owners. On the server
this is `Implemented`; the frontend libraries are `Deferred`
(`04-tech-stack.md` §10-11).

### 11.5 User Feedback Is Part of the System

Loading, success, failure, validation, empty and transitional states are
product behavior (`11-ui-ux-spec.md`).

### 11.6 Measurable Performance

Performance claims are measured, never invented
(`03-non-functional-requirements.md`).

### 11.7 Accessibility by Design

Accessibility is designed in, not audited at the end (`11-ui-ux-spec.md`).

### 11.8 Security by Default

Authentication, authorization, validation, secret handling and API
protection are part of every block (`09-security-spec.md`, ADR-005).

### 11.9 Financial Correctness

Money uses decimal arithmetic and decimal strings on the wire (ADR-002);
analytics follow one documented methodology with hand-computed tests
(ADR-004, `16-analytics-spec.md`).

---

## 12. Quality Definition

**Status:** engineering quality `Implemented` for the backend foundation; product and demo quality `Planned (FE)`.

- **Product:** coherent workflows, consistent UI states, no dead-end
  interactions.
- **Engineering:** documented architecture, separated responsibilities,
  testable domain, explicit contracts, deliberate error handling, documented
  security, measurable performance.
- **Demo:** no unfinished screens, non-functional primary actions,
  unexplained placeholders, broken navigation or missing feedback.
- **Interview:** every architecture and technology choice can be explained
  with its alternatives and trade-offs, through its ADR.

---

## 13. Documentation Strategy

**Status:** `Implemented`

The document map, precedence and status legend live in
[`README.md`](README.md); this section only summarizes them.

| Set | Contents |
| --- | --- |
| ADRs ([`adr/`](adr/README.md)) | One closed decision each; highest precedence. |
| SDD `00`-`16` | `00-overview.md` to `15-implementation-plan.md`, plus `16-analytics-spec.md` (ADR-004). |
| `BACKEND-ROADMAP.md` | Backend blocks B0-B7. |
| `PROGRESS.md` | Working log. |

Every section carries a status: `Implemented`, `Planned (B#)`,
`Planned (FE)` or `Deferred`.

---

## 14. Development and Specification Rule

**Status:** `Implemented`

The SDD is the source of truth for intended behavior and architecture.
Precedence is ADR > SDD > `BACKEND-ROADMAP.md` > `PROGRESS.md`; code is
evidence of what exists, not authority on what must exist.

- No significant functionality is built without a specification.
- A new open decision is closed in an ADR before code depends on it.
- A change that diverges from a document updates that document in the same
  pull request, and `pnpm docs:check` must pass.

```text
Discover problem → Evaluate alternatives → Record decision (ADR) → Update specification → Implement → Validate
```

---

## 15. Portfolio Representation

**Status:** `Deferred` — written after the frontend stage.

The case study follows the existing project-page structure (summary,
context, architecture, decisions, challenges, security, performance, stack,
outcomes, lessons, future evolution). It uses only the actual system,
measured results and recorded decisions; no placeholder claims.

---

## 16. Success Criteria

**Status:** per criterion.

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Core scope (§5.1) implemented. | per §5.1 |
| 2 | Public demo fully functional on simulated infrastructure. | `Planned (FE)` |
| 3 | Primary workflows end to end in the demo. | `Planned (FE)` |
| 4 | Validation, error, loading, success, empty and transitional states. | API `Implemented`; UI `Planned (FE)` |
| 5 | Full stack runs locally. | API and database `Implemented`; containerized run `Planned (B7)` |
| 6 | Architecture documented. | `Implemented` |
| 7 | Security implemented and documented. | foundation `Implemented`; sessions `Planned (B2)`; hardening `Planned (B7)` |
| 8 | Relevant automated tests, run in CI. | tests `Implemented`; CI `Planned (B0)` |
| 9 | Performance measured, not estimated. | slow-request and analytics timing `Planned (B3)` (ADR-009 point 8); UI `Planned (FE)` |
| 10 | Defensible in a technical interview. | `Implemented` through the ADRs |
| 11 | Demo online without recurring paid services. | `Planned (FE)` |
| 12 | Documentation matches the implementation. | `Implemented` (`pnpm docs:check`, same-PR rule) |

---

## 17. Guiding Principle

**Status:** `Implemented`

> **The goal is not to build the largest system possible. The goal is to demonstrate deliberate engineering decisions through a realistic, maintainable, measurable, and fully interactive software system.**
