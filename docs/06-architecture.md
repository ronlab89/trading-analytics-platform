# SDD 06 — Architecture

**Project:** Trading Analytics Platform  
**Status:** Draft  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`, `05-data-model.md`

---

# 1. Purpose

This document defines the software architecture for Trading Analytics Platform.

The architecture must support two execution modes:

1. **Demo Mode** — fully functional public experience using mocked infrastructure.
2. **Production Mode** — complete application using real backend infrastructure and persistence.

Both modes must share the same core application contracts and domain behavior.

The primary architectural goal is:

> Build a system that is simple enough to maintain, structured enough to scale, and realistic enough to demonstrate production-oriented engineering.

---

# 2. Architectural Goals

The architecture must prioritize:

- clear domain boundaries;
- maintainability;
- testability;
- predictable state management;
- performance;
- security;
- real-time capability;
- infrastructure substitution;
- incremental scalability;
- strong developer experience;
- zero required operating cost for the public demo.

---

# 3. Architectural Principles

## 3.1 Domain First

The architecture should reflect the product's domains rather than the visual structure of the UI.

Primary domains:

```text
Portfolio
Position
Transaction
Asset
Market Data
Analytics
Decision
Scenario
Notification
```

---

## 3.2 Explicit Boundaries

Dependencies should flow through explicit boundaries.

The system should avoid unrestricted access between modules.

---

## 3.3 Dependency Inversion

Application and domain logic should depend on contracts rather than infrastructure implementations.

Conceptually:

```text
Application
     ↓
Interface / Contract
     ↑
     │
 ┌───┴──────────┐
 │              │
Mock Adapter   Real Adapter
```

---

## 3.4 Infrastructure Is Replaceable

The application should not fundamentally care whether data comes from:

- a mock repository;
- an HTTP API;
- a database;
- a real-time server.

Infrastructure is an implementation detail.

---

## 3.5 Avoid Premature Distribution

The initial system will use a modular architecture rather than microservices.

Microservices are explicitly not required for the first version.

The system should be designed so that domains are separable without forcing deployment separation prematurely.

---

# 4. High-Level Architecture

The system follows a modular layered architecture.

```text
┌─────────────────────────────────────────────────────────┐
│                    Presentation                         │
│ React UI · Routes · Components · Charts · Interaction  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                     Application                         │
│ Use Cases · Commands · Queries · Orchestration         │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                       Domain                            │
│ Entities · Rules · Value Objects · Calculations         │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                    Infrastructure                       │
│ API · Database · Auth · Realtime · External Services   │
└─────────────────────────────────────────────────────────┘
```

The exact implementation may adapt this model where frontend-specific concerns require it.

---

# 5. System Context

```text
                    ┌───────────────────┐
                    │   Portfolio User  │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   Web Client      │
                    │ React + TypeScript│
                    └─────────┬─────────┘
                              │
                   ┌──────────┴──────────┐
                   │                     │
                   ▼                     ▼
             Application API       Realtime Channel
                   │                     │
                   ▼                     ▼
             Backend Services      Event Processing
                   │
          ┌────────┼─────────┐
          ▼        ▼         ▼
       Database  Cache   External APIs
```

In Demo Mode:

```text
                    Web Client
                        │
                        ▼
                Application Layer
                        │
                        ▼
                 Mock Adapters
                  │           │
                  ▼           ▼
             Seed Data   Simulation Engine
```

---

# 6. Execution Modes

## 6.1 Demo Mode

The public demo must run without requiring:

- paid APIs;
- external financial providers;
- persistent backend infrastructure;
- paid authentication;
- paid realtime services.

Architecture:

```text
React Application
       │
       ▼
Application Services
       │
       ▼
Domain Logic
       │
       ├───────────────┐
       ▼               ▼
Mock Repositories   Simulation Engine
       │               │
       └───────┬───────┘
               ▼
          Session State
```

---

## 6.2 Production Mode

The complete application uses real infrastructure.

```text
React Client
     │
     ▼
HTTP API
     │
     ▼
Backend Application
     │
 ┌───┼───────────────┐
 ▼   ▼               ▼
DB  Cache      External Services
     │
     ▼
Realtime Infrastructure
```

---

# 7. Frontend Architecture

The frontend uses a feature-oriented modular architecture.

Recommended structure:

```text
src/
├── app/
│   ├── router/
│   ├── providers/
│   ├── configuration/
│   └── bootstrap/
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── portfolios/
│   ├── positions/
│   ├── transactions/
│   ├── assets/
│   ├── watchlist/
│   ├── analytics/
│   ├── decisions/
│   ├── scenarios/
│   └── notifications/
│
├── entities/
│   ├── portfolio/
│   ├── asset/
│   ├── position/
│   ├── transaction/
│   └── decision/
│
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── utilities/
│   ├── validation/
│   └── types/
│
├── infrastructure/
│   ├── api/
│   ├── repositories/
│   ├── realtime/
│   ├── mock/
│   └── storage/
│
└── domain/
    ├── portfolio/
    ├── analytics/
    ├── scenarios/
    └── decisions/
```

The exact directory structure may evolve during implementation.

The important constraint is ownership and dependency direction.

---

# 8. Feature Modules

Each feature should own its feature-specific:

- UI;
- hooks;
- application interactions;
- validation;
- types;
- queries;
- mutations.

Example:

```text
features/transactions/

components/
hooks/
queries/
mutations/
schemas/
types/
```

A feature should not directly manipulate another feature's internal implementation.

---

# 9. Shared Layer

The shared layer contains genuinely reusable infrastructure.

Examples:

- Button;
- Dialog;
- Input;
- Table;
- Tooltip;
- Date utilities;
- formatting;
- generic hooks;
- design primitives.

Shared components must remain domain-agnostic.

A portfolio-specific component should not be placed in `shared`.

---

# 10. Domain Layer

The domain layer contains business rules that should remain independent from:

- React;
- HTTP;
- browser APIs;
- database;
- UI components.

Examples:

```text
calculatePositionMetrics()
calculatePortfolioMetrics()
calculateAllocation()
calculateAttribution()
calculateDrawdown()
calculateVolatility()
calculateScenarioImpact()
calculatePortfolioPulse()
```

These functions should be deterministic where possible.

---

# 11. Application Layer

The application layer coordinates domain operations.

Examples:

```text
CreatePortfolio
RecordTransaction
UpdateWatchlist
CreateScenario
CalculateScenario
ReplayDecision
GetPortfolioOverview
GetPerformanceAnalytics
```

Application services may coordinate:

- repositories;
- domain calculations;
- validation;
- transactions;
- event publication.

They should not contain presentation logic.

---

# 12. Repository Pattern

Repositories provide an abstraction over data access.

Example:

```text
interface PortfolioRepository {
  getAll(): Promise<Portfolio[]>
  getById(id: string): Promise<Portfolio | null>
  create(input: CreatePortfolioInput): Promise<Portfolio>
  update(id: string, input: UpdatePortfolioInput): Promise<Portfolio>
  delete(id: string): Promise<void>
}
```

The application layer depends on the interface.

Implementations may include:

```text
MockPortfolioRepository
ApiPortfolioRepository
```

---

# 13. Mock Infrastructure

The demo uses mock implementations behind the same contracts.

Example:

```text
PortfolioRepository
      │
      ├── MockPortfolioRepository
      │
      └── ApiPortfolioRepository
```

This allows the UI and application logic to remain identical.

---

# 14. Mock Data Engine

The mock infrastructure should contain separate responsibilities.

```text
Seed Data
    ↓
Mock Store
    ↓
Repository
    ↓
Application
```

The seed data should not be mutated directly.

The mock store owns session mutations.

---

# 15. Mock API Simulation

The mock adapter should simulate realistic asynchronous behavior.

Capabilities:

- configurable latency;
- successful responses;
- validation errors;
- server errors;
- timeout;
- retryable failures.

Example:

```text
Repository call
      ↓
Simulated latency
      ↓
Scenario selection
      ↓
Success / Error
      ↓
Response
```

The UI must consume it exactly like an asynchronous real service.

---

# 16. Failure Injection

The demo should provide controlled failure simulation.

Possible mechanisms:

```text
Demo Controls
    │
    ├── Force API Error
    ├── Force Timeout
    ├── Simulate Realtime Disconnect
    └── Force Background Failure
```

Failure injection must remain isolated from normal production logic.

---

# 17. State Management Strategy

State should be classified before being stored.

## Server State

Examples:

- portfolios;
- transactions;
- positions;
- assets;
- historical data.

Managed through a server-state strategy such as TanStack Query.

---

## Client State

Examples:

- selected portfolio;
- modal state;
- filters;
- UI preferences;
- replay controls;
- scenario editing state.

Managed through lightweight client state such as Zustand where appropriate.

---

## Derived State

Examples:

- portfolio performance;
- allocation;
- P/L;
- pulse;
- scenario results.

Derived values should not automatically be persisted as independent client state.

---

# 18. State Ownership

Every state value must have a clear owner.

Example:

```text
Selected Portfolio
      ↓
Client State

Portfolio Data
      ↓
Server State

Portfolio Performance
      ↓
Derived Domain State
```

The architecture should avoid multiple competing sources of truth.

---

# 19. Server State Synchronization

Mutations should invalidate or update relevant cached state.

Example:

```text
Create Transaction
       ↓
Transaction Cache
       ↓
Position Cache
       ↓
Portfolio Cache
       ↓
Analytics Cache
```

The final invalidation strategy should balance correctness and performance.

---

# 20. Real-Time Architecture

Real-time market events should be isolated from the UI.

```text
Realtime Connection
       ↓
Event Adapter
       ↓
Event Normalization
       ↓
Application State
       ↓
Selective Updates
       ↓
UI
```

The UI must not directly parse raw realtime infrastructure events.

---

# 21. Event Model

A normalized internal event structure should be used.

Example:

```text
{
  type: "MARKET_PRICE_UPDATED",
  assetId: "...",
  price: 123.45,
  timestamp: "...",
  sequence: 1234
}
```

Infrastructure-specific payload formats should be converted at the boundary.

---

# 22. Real-Time State Updates

When a market event arrives:

```text
Market Event
    ↓
Validate
    ↓
Check ordering
    ↓
Update market state
    ↓
Recalculate affected position
    ↓
Recalculate affected portfolio metrics
    ↓
Update relevant analytics
    ↓
Notify UI subscribers
```

Unrelated portfolios or components should not be recalculated unnecessarily.

---

# 23. Real-Time Connection Lifecycle

The realtime subsystem must expose connection state:

```text
DISCONNECTED
      ↓
CONNECTING
      ↓
CONNECTED
      ↓
RECONNECTING
      ↓
CONNECTED
```

Failure:

```text
RECONNECTING
      ↓
FAILED
```

The UI consumes normalized connection state.

---

# 24. Backend Architecture

The backend should follow modular boundaries.

Conceptual structure:

```text
backend/
├── modules/
│   ├── auth/
│   ├── portfolios/
│   ├── positions/
│   ├── transactions/
│   ├── assets/
│   ├── market/
│   ├── analytics/
│   ├── decisions/
│   ├── scenarios/
│   └── notifications/
│
├── shared/
│   ├── errors/
│   ├── validation/
│   ├── logging/
│   └── utilities/
│
└── infrastructure/
    ├── database/
    ├── cache/
    ├── realtime/
    └── external/
```

The final backend framework can be selected based on the implementation trade-offs.

---

# 25. Backend Module Structure

Each major module should separate responsibilities.

Conceptually:

```text
module/
├── domain/
├── application/
├── infrastructure/
└── presentation/
```

Not every small feature requires all four directories.

Architecture should scale with complexity.

---

# 26. API Boundary

The backend exposes purpose-specific APIs rather than exposing database structures directly.

Example:

```text
GET /portfolios
GET /portfolios/:id
POST /portfolios

GET /portfolios/:id/positions
GET /portfolios/:id/transactions

GET /portfolios/:id/analytics
GET /portfolios/:id/decisions
GET /portfolios/:id/scenarios
```

Exact endpoint design will be defined in `07-api-spec.md`.

---

# 27. DTO Boundary

External API responses should use DTOs.

```text
Database Model
      ↓
Domain Model
      ↓
Application
      ↓
Response DTO
      ↓
API
```

Database implementation details must not leak into the client.

---

# 28. Validation Architecture

Validation should occur at multiple boundaries.

```text
User Input
    ↓
Frontend Schema
    ↓
API Validation
    ↓
Application Rules
    ↓
Domain Rules
```

Each layer serves a different purpose.

---

# 29. Error Architecture

The backend should expose normalized application errors.

Categories may include:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
TIMEOUT
DEPENDENCY_ERROR
INTERNAL_ERROR
```

The frontend should map these into appropriate UX states.

Internal stack traces must never be exposed to users.

---

# 30. Transaction Boundaries

Operations that modify multiple related records should use explicit transaction boundaries where persistence technology supports them.

Example:

```text
Create Transaction
       │
       ├── Transaction Record
       ├── Position Update
       └── Related State
              │
              ▼
          Commit
```

Failure should result in rollback where required.

---

# 31. Event-Driven Capabilities

The architecture should support internal events where they provide real value.

Example:

```text
TransactionCompleted
        ↓
 ┌──────┼──────────┐
 ↓      ↓          ↓
Position Analytics Notification
Update   Update      Check
```

Events should not be introduced merely for architectural appearance.

---

# 32. Background Processing

Long-running tasks should not block synchronous API requests.

Potential tasks:

- large analytics calculations;
- imports;
- historical data processing;
- report generation.

Conceptually:

```text
Request
  ↓
Create Job
  ↓
Queued
  ↓
Processing
  ↓
Completed / Failed
```

The public demo shall simulate this lifecycle.

---

# 33. Caching Strategy

Caching should be introduced where it solves a demonstrated performance problem.

Potential candidates:

- frequently requested portfolio summaries;
- market state;
- historical analytics;
- static reference data.

The cache must never become the only authoritative source for critical data.

---

# 34. Database Strategy

The production application should use a relational or otherwise appropriate persistent datastore capable of maintaining transactional integrity.

The exact database technology will be selected based on:

- relational requirements;
- query patterns;
- free-tier availability;
- operational simplicity;
- developer experience.

The demo does not require a production database.

---

# 35. Persistence Abstraction

Persistence access must remain behind infrastructure boundaries.

```text
Application
     ↓
Repository
     ↓
Persistence Adapter
     ↓
Database
```

This allows the domain/application layers to remain independent of the selected database technology.

---

# 36. Authentication Architecture

Authentication should be isolated as a dedicated capability.

```text
Authentication
      ↓
Identity
      ↓
Session
      ↓
Authorization
```

The application should not scatter authentication logic across individual features.

---

# 37. Authorization Architecture

Authorization must be enforced at protected application boundaries.

Conceptually:

```text
Request
  ↓
Authenticate
  ↓
Identify User
  ↓
Check Permission
  ↓
Execute Use Case
```

The frontend may hide unavailable actions for UX purposes but must not be responsible for enforcement.

---

# 38. Security Boundary

The security boundary exists primarily at the backend.

```text
Untrusted Client
       ↓
API Boundary
       ↓
Validation
       ↓
Authorization
       ↓
Application
       ↓
Domain
       ↓
Infrastructure
```

No client-provided value should be trusted simply because the frontend validated it.

---

# 39. Observability Architecture

The backend should provide:

- structured logging;
- request correlation;
- error context;
- health checks;
- relevant domain events.

Example:

```text
Request
  ↓
Correlation ID
  ↓
Application Service
  ↓
Repository
  ↓
Structured Logs
```

Sensitive information must be excluded.

---

# 40. Frontend Error Boundaries

The frontend should isolate unexpected rendering failures.

A component failure should not necessarily destroy the entire application session.

Appropriate boundaries should exist around major application surfaces.

---

# 41. Routing Architecture

Routes should be separated into:

```text
Public
├── /
├── /projects
└── /demo

Authenticated
├── /dashboard
├── /portfolios
├── /transactions
├── /analytics
├── /decisions
└── /scenarios
```

The exact public route structure may depend on portfolio integration.

---

# 42. Feature Dependency Rules

Feature modules should not create uncontrolled dependency graphs.

Preferred:

```text
Feature
   ↓
Application Contract
   ↓
Domain
```

Avoid:

```text
Feature A → Feature B → Feature C → Feature A
```

Circular dependencies are prohibited.

---

# 43. Import Boundaries

The implementation should enforce architectural boundaries through tooling where practical.

Possible mechanisms:

- ESLint import restrictions;
- path aliases;
- module conventions;
- dependency rules.

Architecture should be enforced automatically where possible rather than relying solely on documentation.

---

# 44. Dependency Direction

Preferred dependency direction:

```text
Presentation
     ↓
Application
     ↓
Domain

Infrastructure → Application/Domain Contracts
```

The domain should not depend on:

- React;
- database drivers;
- HTTP clients;
- browser APIs.

---

# 45. Configuration

Configuration should be centralized.

Examples:

```text
API URL
Environment
Feature Flags
Demo Mode
Realtime Configuration
Logging Level
```

Configuration should not be scattered throughout feature modules.

---

# 46. Feature Flags

Feature flags may be used for:

- experimental capabilities;
- demo-only functionality;
- gradual rollout.

They should not become a substitute for proper architecture.

---

# 47. Demo Mode Boundary

Demo-specific capabilities should live behind an explicit boundary.

Example:

```text
DemoController
    │
    ├── Seed
    ├── Reset
    ├── Simulation
    └── Failure Injection
```

Production application logic should not depend on this controller.

---

# 48. Demo Simulation Engine

The simulation engine is responsible for controlled artificial events.

Potential responsibilities:

- price generation;
- event scheduling;
- connection interruption;
- background job simulation;
- failure injection.

It should expose events through the same normalized event contracts used by the real infrastructure.

---

# 49. Simulation Determinism

The simulator should support deterministic behavior when required.

Example:

```text
Seed
 +
Simulation Configuration
      ↓
Predictable Event Sequence
```

This allows reproducible demonstrations and tests.

---

# 50. Data Flow Example — Transaction

Complete flow:

```text
User
 ↓
Transaction Form
 ↓
Client Validation
 ↓
Create Transaction Use Case
 ↓
Transaction Repository
 ↓
Mock API / Real API
 ↓
Transaction Created
 ↓
Domain Recalculation
 ↓
Position Updated
 ↓
Portfolio Metrics Updated
 ↓
Analytics Updated
 ↓
Cache / State Synchronization
 ↓
UI Feedback
```

---

# 51. Data Flow Example — Real-Time Price

```text
Market Event
 ↓
Realtime Adapter
 ↓
Normalize Event
 ↓
Validate Sequence
 ↓
Market State
 ↓
Affected Positions
 ↓
Portfolio Metrics
 ↓
Relevant Analytics
 ↓
UI Subscribers
```

---

# 52. Data Flow Example — Scenario

```text
Baseline Portfolio
       ↓
Scenario Changes
       ↓
Scenario Calculation
       ↓
Domain Analytics
       ↓
Scenario Result
       ↓
Visualization
```

The baseline must remain unchanged.

---

# 53. Data Flow Example — Decision Replay

```text
Decision
   ↓
Ordered Events
   ↓
Replay Controller
   ↓
Current Event Index
   ↓
Derived Replay State
   ↓
UI
```

Replay should be a projection of history, not a mutation of historical records.

---

# 54. Performance Architecture

Performance optimization should occur at multiple levels.

```text
Network
  ↓
API
  ↓
Data Fetching
  ↓
State
  ↓
Computation
  ↓
Rendering
```

Optimization should be evidence-driven.

---

# 55. Rendering Strategy

The frontend should minimize unnecessary rendering.

Techniques may include:

- component boundaries;
- selective subscriptions;
- memoization where useful;
- virtualization;
- chart windowing;
- derived selectors.

Optimization must not make the code unnecessarily difficult to understand.

---

# 56. Chart Architecture

Charts should consume prepared data rather than perform complex domain calculations directly inside rendering components.

Preferred:

```text
Raw Data
   ↓
Domain Calculation
   ↓
Chart View Model
   ↓
Chart Component
```

This keeps visualization concerns separate from financial calculations.

---

# 57. Scalability Path

The architecture should allow gradual evolution.

### Stage 1

```text
Single Frontend
Single Backend
Single Database
```

### Stage 2

```text
Multiple Backend Instances
Shared Cache
Realtime Infrastructure
```

### Stage 3

```text
Dedicated Workers
Event Infrastructure
Specialized Services
```

Stage 3 should only be introduced when justified by actual scale.

---

# 58. Deployment Architecture

Initial production deployment should prioritize free-tier compatibility.

Conceptual:

```text
Frontend Hosting
      │
      ▼
Backend Hosting
      │
 ┌────┴─────┐
 ▼          ▼
Database   Realtime
```

Exact providers are intentionally deferred to the deployment specification.

---

# 59. Cost-Aware Architecture

The architecture must avoid infrastructure that creates unnecessary recurring costs.

The demo must be deployable using:

- static/client hosting where possible;
- mock infrastructure;
- free-tier compatible services;
- local simulation.

No paid financial API is required.

---

# 60. Testing Architecture

The architecture should support multiple testing levels.

```text
Domain
  ↓
Unit Tests

Application
  ↓
Integration Tests

API
  ↓
Contract / Integration Tests

UI
  ↓
Component / Interaction Tests

Complete Product
  ↓
End-to-End Tests
```

The detailed strategy is defined in `10-testing-strategy.md`.

---

# 61. Architectural Trade-Offs

## Modular Monolith vs Microservices

### Decision

Use a modular monolith.

### Reason

The product does not initially require independent deployment or scaling of individual domains.

### Benefits

- lower operational complexity;
- easier local development;
- lower cost;
- easier debugging;
- simpler deployment.

### Future

Domains remain sufficiently isolated to extract later if scale justifies it.

---

## REST/HTTP vs Event-First Architecture

### Decision

Use HTTP APIs as the primary request/response boundary and realtime/events only where they provide clear value.

### Reason

Most application operations are naturally request/response.

Real-time events are justified for:

- market updates;
- connection state;
- asynchronous processing.

---

## Client State vs Server State

### Decision

Separate server state from client state.

### Reason

This avoids turning global state into a generic storage mechanism.

---

# 62. Architectural Anti-Patterns

The implementation should avoid:

### God Components

Components responsible for:

- data fetching;
- business logic;
- validation;
- calculations;
- rendering;
- mutations.

### God Stores

One global store containing the entire application.

### API Leakage

UI components directly constructing infrastructure-specific requests.

### Domain Leakage

Financial calculations embedded inside visual components.

### Mock Leakage

Production logic depending on demo-only implementation details.

### Premature Microservices

Splitting domains into independently deployed services without an actual requirement.

---

# 63. Architecture Decision Records

Significant architectural decisions should be documented using ADRs.

Examples:

```text
ADR-001 Modular Monolith
ADR-002 Repository Abstraction
ADR-003 Server vs Client State
ADR-004 Realtime Strategy
ADR-005 Authentication Strategy
ADR-006 Persistence Technology
ADR-007 Mock Infrastructure
```

The exact ADR list will evolve during implementation.

---

# 64. Architecture Quality Gates

The architecture is acceptable when:

- domain logic is independent from UI;
- infrastructure is replaceable;
- mock and real implementations share contracts;
- server and client state have clear ownership;
- realtime events are normalized;
- derived state has a clear source;
- cross-domain dependencies are controlled;
- authentication and authorization boundaries are explicit;
- production infrastructure can evolve independently;
- demo infrastructure does not contaminate production logic;
- no unnecessary distributed architecture exists.

---

# 65. Architectural Success Definition

The architecture should make the following scenario possible:

```text
Today
─────
Public Demo
+
Mock Infrastructure
+
Free Hosting

             ↓

Tomorrow
─────────
Real API
+
Database
+
Realtime Infrastructure

             ↓

Future
──────
Higher Traffic
+
Workers
+
Caching
+
Additional Services
```

without requiring a complete rewrite of the application or domain logic.

---

# 66. Final Architectural Principle

The architecture should communicate engineering maturity through **clarity and trade-offs**, not through technological complexity.

The ideal result is:

```text
                 PRODUCT
                    │
          ┌─────────┴─────────┐
          ↓                   ↓
         UX               ENGINEERING
          │                   │
          └─────────┬─────────┘
                    ↓
              DOMAIN MODEL
                    ↓
           EXPLICIT CONTRACTS
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
   REAL INFRASTRUCTURE     MOCK INFRASTRUCTURE
        │                       │
        └───────────┬───────────┘
                    ↓
             SAME BEHAVIOR
```

The public demo is not a simplified version of the product.

It is the same application behavior running against controlled infrastructure.

That distinction is fundamental to the architecture.
