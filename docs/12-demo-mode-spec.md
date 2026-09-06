# Trading Analytics Platform
## Demo Mode Specification

**Document:** `12-demo-mode-spec.md`  
**Version:** 1.0  
**Status:** Specification  
**Scope:** Public demo infrastructure and behavior

---

## 1. Purpose

This document defines how the public demo of the Trading Analytics Platform must work.

The demo is not a visual prototype or a collection of hard-coded screens. It is a functional runtime of the product that replaces real infrastructure with deterministic mock infrastructure.

The core principle is:

> **Demo ≠ static prototype.**  
> **Demo = full product behavior + mock infrastructure.**

The demo must preserve, as far as practical, the same:

- product flows;
- domain rules;
- application behavior;
- validation;
- loading states;
- error handling;
- asynchronous behavior;
- realtime concepts;
- state transitions;
- UX patterns.

Only infrastructure that would normally require external resources is simulated.

---

# 2. Goals

The public demo must allow a visitor to:

- enter the product without setup;
- navigate the complete primary experience;
- inspect portfolios;
- inspect positions;
- inspect transactions;
- inspect analytics;
- search and filter data;
- submit supported simulated operations;
- experience validation;
- observe loading states;
- encounter realistic errors;
- retry recoverable operations;
- observe realtime updates;
- simulate realtime disconnection;
- observe reconnection;
- trigger alerts;
- run background processes;
- observe progress;
- reset the demo.

The demo must also provide enough control for a technical reviewer to demonstrate architectural behavior intentionally.

---

# 3. Non-Goals

The demo is not intended to:

- reproduce real financial markets;
- execute real trades;
- connect to brokerages;
- provide real investment advice;
- reproduce a complete production backend;
- reproduce real market-data infrastructure;
- replace production infrastructure;
- simulate every possible failure;
- become a second application with duplicated business logic.

The demo should simulate only what is necessary to provide a convincing product experience.

---

# 4. Core Principle: Infrastructure Substitution

The application architecture must allow real and demo infrastructure to implement the same contracts.

Conceptually:

```text
                    Application
                         │
                Repository contracts
                         │
             ┌───────────┴───────────┐
             │                       │
        Real adapters            Demo adapters
             │                       │
      PostgreSQL / API          Mock repositories
      WebSocket                 Simulation engine
      Workers                   Local persistence
```

The application layer should not care which adapter is active.

For example:

```ts
interface PortfolioRepository {
  list(): Promise<Portfolio[]>;
  getById(id: string): Promise<Portfolio | null>;
  create(input: CreatePortfolioInput): Promise<Portfolio>;
  update(id: string, input: UpdatePortfolioInput): Promise<Portfolio>;
  delete(id: string): Promise<void>;
}
```

Both:

```text
PostgresPortfolioRepository
```

and:

```text
MockPortfolioRepository
```

should satisfy the same contract.

---

# 5. Architectural Boundary

The recommended dependency direction is:

```text
UI
 ↓
Features
 ↓
Application
 ↓
Domain
 ↓
Interfaces
 ↓
Infrastructure
```

Demo infrastructure belongs below the infrastructure boundary.

It must not leak demo-specific behavior into the domain.

Preferred:

```text
Application
    │
    ▼
Repository interface
    │
    ▼
Demo repository
```

Avoid:

```text
Component
    │
    └── if demo → fake data
```

and:

```text
Domain
    │
    └── if demo → bypass rule
```

---

# 6. Runtime Modes

The application should support explicit runtime modes:

```text
demo
development
production
```

Conceptually:

```text
APP_MODE=demo
```

The exact environment variables will be finalized in `14-deployment-spec.md`.

## 6.1 Demo

Demo mode:

- uses mock infrastructure;
- uses deterministic seed data;
- does not require PostgreSQL;
- does not require external APIs;
- does not require real credentials;
- enables simulation controls;
- supports reset;
- supports deterministic scenarios.

## 6.2 Development

Development mode may use the real backend and local infrastructure.

Expected infrastructure includes:

```text
React
Node.js
Express
PostgreSQL
WebSocket
Docker
```

## 6.3 Production

Production mode uses real infrastructure and must not expose demo controls.

---

# 7. Demo Composition Root

Infrastructure selection should happen in one controlled composition layer.

Conceptually:

```ts
const infrastructure =
  mode === "demo"
    ? createDemoInfrastructure()
    : createRealInfrastructure();
```

The composition root should configure:

- repositories;
- services;
- authentication;
- persistence;
- realtime;
- background jobs;
- simulation engine.

Feature modules should consume interfaces rather than deciding which infrastructure to use.

---

# 8. Demo Infrastructure

The demo infrastructure may contain:

```text
DemoRepositoryFactory
DemoServiceFactory
DemoSimulationEngine
DemoMarketEngine
DemoRealtimeAdapter
DemoScenarioRunner
DemoFailureInjector
DemoPersistenceAdapter
DemoSessionAdapter
DemoResetManager
```

These are conceptual modules, not mandatory classes.

An abstraction should only be created when it provides practical value.

---

# 9. Mock Repositories

Mock repositories represent local data access.

Possible repositories:

```text
MockUserRepository
MockPortfolioRepository
MockPositionRepository
MockTransactionRepository
MockAlertRepository
```

Responsibilities:

- retrieve data;
- create entities;
- update entities;
- delete entities where supported;
- maintain relationships;
- expose asynchronous behavior;
- return typed results;
- simulate relevant failures.

Repositories must not know about React components or UI presentation.

---

# 10. Mock Services

Infrastructure-dependent behavior should be represented through services.

Possible services:

```text
MockMarketDataService
MockRealtimeService
MockNotificationService
MockBackgroundJobService
MockAuthenticationService
```

Services should model the same conceptual contracts used by the real implementation.

---

# 11. Mock API

The demo may be entirely frontend-local or may expose a mock API layer.

If a mock API is used, it must behave like an API:

```text
Request
 ↓
Validation
 ↓
Latency
 ↓
Business operation
 ↓
Response
```

It must not simply return hard-coded JSON from a component.

---

# 12. Demo State

Demo state should have explicit ownership.

Conceptually:

```text
DemoState
 ├── session
 ├── portfolios
 ├── positions
 ├── transactions
 ├── alerts
 ├── notifications
 ├── market
 ├── realtime
 ├── jobs
 └── simulation
```

The implementation must avoid multiple independent sources of truth for the same domain entity.

Zustand, TanStack Query, repositories, and local persistence should each have clearly defined responsibilities.

---

# 13. Initial Dataset

The demo must start with a coherent dataset.

Recommended baseline:

```text
1 demo user

2+ portfolios

Multiple positions

Multiple transactions

Multiple alerts

Historical analytics data
```

The data should contain meaningful variation.

Positions should include:

- profitable;
- losing;
- approximately flat.

Transactions should include:

- buy;
- sell;
- cash movement where applicable.

Alerts should include:

- active;
- triggered;
- disabled.

An optional empty portfolio may be included to demonstrate empty states.

---

# 14. Demo Data Integrity

Mock data must obey domain relationships.

Example:

```text
Portfolio
 ├── cash
 ├── positions
 └── transactions
```

Position values should be derived consistently.

Example:

```text
market value
=
quantity × current price
```

and:

```text
unrealized P/L
=
market value − cost basis
```

Exact formulas must follow the domain model.

The demo must not present contradictory values merely to make the UI look populated.

---

# 15. Demo Data Factories

Mock entities should preferably be generated through typed factories.

Examples:

```text
createMockUser()
createMockPortfolio()
createMockPosition()
createMockTransaction()
createMockAlert()
```

Factories should accept overrides.

Example concept:

```ts
createMockPosition({
  symbol: "DEMO",
  quantity: 10,
});
```

This makes scenarios and tests easier to maintain.

---

# 16. Deterministic Seed

The demo should have a known seed.

Conceptually:

```text
DEMO_SEED = "ronlabdev-trading-demo-v1"
```

The seed should control deterministic simulation where required.

It may influence:

- initial data;
- pseudo-random market movements;
- scenarios;
- failure sequences.

The actual seed value can change during implementation.

---

# 17. Deterministic Behavior

Deterministic behavior is required for:

- scenarios;
- automated tests;
- reset;
- interview demonstrations;
- bug reproduction.

Starting the same scenario from the same state should produce the same expected behavior.

Ambient simulation may be pseudo-random, but randomness must be controllable.

---

# 18. Local Persistence

The demo may persist state locally.

Potential data:

- created portfolios;
- modified portfolio state;
- settings;
- selected portfolio;
- simulation preferences;
- dismissed notifications;
- active demo scenario;
- demo state version.

Possible storage:

```text
localStorage
IndexedDB
```

The simplest appropriate mechanism should be preferred.

No sensitive information should be persisted.

---

# 19. Persistence Versioning

Persisted demo state must include a version.

Conceptually:

```text
demoStateVersion
```

When the demo is deployed with an incompatible state model, the application should either:

- migrate the state; or
- discard and recreate it.

Old browser state must never cause an unrecoverable application error.

---

# 20. Reset

Reset is a first-class feature.

It must restore:

```text
Initial data
Initial market state
Initial alerts
Initial notifications
Initial jobs
Initial simulation state
Initial scenario
Initial persistence
```

Conceptual flow:

```text
Reset Demo
   ↓
Confirmation
   ↓
Stop simulation
   ↓
Clear persisted state
   ↓
Restore seed
   ↓
Recreate repositories
   ↓
Restart simulation
   ↓
Refresh application
   ↓
Show confirmation
```

Reset must be safe and idempotent.

---

# 21. Reset Isolation

Reset must affect only demo state.

It must never:

- call production APIs;
- access production databases;
- invalidate real accounts;
- modify real data.

---

# 22. Simulated Latency

The demo should simulate realistic asynchronous latency.

Suggested profiles:

```text
instant
fast
normal
slow
```

Suggested conceptual ranges:

```text
Fast read:        100–250 ms
Normal read:      250–600 ms
Write:             400–900 ms
Slow operation:    1–3 s
Background job:    several seconds
```

These values are UX simulation parameters, not performance claims.

---

# 23. Latency Controller

Latency must be centralized.

Avoid:

```ts
await new Promise(resolve => setTimeout(resolve, 500));
```

being duplicated throughout components.

Prefer a shared simulation mechanism:

```text
Mock operation
 ↓
Latency controller
 ↓
Operation
```

This allows consistent behavior and easier testing.

---

# 24. Loading States

The demo must intentionally exercise loading states.

Examples:

- dashboard loading;
- table loading;
- portfolio creation;
- transaction submission;
- analytics loading;
- report generation;
- realtime reconnection.

Loading UI must follow `11-ui-ux-spec.md`.

---

# 25. Failure Injection

Failure injection is a first-class simulation capability.

Supported categories should include:

### Network

```text
offline
timeout
connection interruption
```

### API

```text
400
401
403
404
409
429
500
503
```

### Realtime

```text
disconnect
connection failure
delayed reconnect
```

### Background jobs

```text
failure
timeout
interrupted progress
```

Only meaningful failures should be implemented for each feature.

---

# 26. Failure Profiles

Failures should be represented as explicit simulation instructions.

Conceptually:

```ts
type FailureScenario =
  | "network-error"
  | "timeout"
  | "validation-error"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "server-error"
  | "service-unavailable"
  | "realtime-disconnect"
  | "job-failure";
```

The exact type system may be refined during implementation.

---

# 27. Failure Determinism

Failure injection should be reproducible.

Example:

```text
Scenario:
server-error-retry

Attempt 1 → 500
Attempt 2 → success
```

This is preferable to:

```text
50% random failure
```

for technical demonstrations and E2E tests.

---

# 28. Retry

Retry behavior must respect operation semantics.

Generally:

```text
Read
 → retryable

Temporary network failure
 → retryable

Realtime disconnect
 → reconnectable

Validation error
 → not automatically retryable

Authorization error
 → requires correction

Destructive mutation
 → must not blindly retry
```

The retry strategy should be implemented at the appropriate application/query layer.

---

# 29. Network Simulation

The demo may simulate:

```text
Normal
Slow
Offline
Timeout
```

When offline:

- requests should fail predictably;
- UI should show an appropriate error;
- recovery should be possible;
- realtime state should reflect disconnection.

---

# 30. Realtime Simulation

Realtime is a major demonstration capability.

The simulator must represent:

```text
connected
reconnecting
disconnected
failed
```

Conceptual flow:

```text
Simulation engine
      ↓
Realtime adapter
      ↓
Application event
      ↓
State update
      ↓
UI
```

The UI must not directly control market state.

---

# 31. Realtime Events

Possible typed events:

```text
MARKET_PRICE_UPDATED
POSITION_UPDATED
PORTFOLIO_UPDATED
TRANSACTION_COMPLETED
ALERT_TRIGGERED
REALTIME_CONNECTED
REALTIME_DISCONNECTED
REALTIME_RECONNECTED
JOB_PROGRESS_UPDATED
JOB_COMPLETED
JOB_FAILED
```

Only events that provide real architectural value should be implemented.

---

# 32. Realtime Subscription Model

The application should avoid sending every possible event to every consumer.

Where useful, subscriptions should be scoped.

Example:

```text
Dashboard
 → portfolio updates

Position page
 → selected portfolio / market updates

Alerts
 → relevant market events
```

This helps demonstrate scalable realtime thinking.

---

# 33. Realtime Update Efficiency

Realtime updates must not cause unnecessary global rerenders.

Consider:

- selective subscriptions;
- normalized state;
- batching;
- throttling;
- memoization;
- query cache updates;
- derived state.

A price update for one asset should not unnecessarily rerender the entire application.

---

# 34. Reconnection

The demo must simulate reconnection.

Expected lifecycle:

```text
Connected
 ↓
Disconnected
 ↓
Reconnecting
 ↓
Retry delay
 ↓
Connected
```

Retry delays should use backoff rather than aggressive loops.

---

# 35. Realtime Synchronization

After reconnecting, the client should simulate synchronization.

Conceptual flow:

```text
Disconnected
 ↓
Potential missed events
 ↓
Reconnect
 ↓
Synchronize current state
 ↓
Resume events
```

The application must not assume that no state changed while disconnected.

---

# 36. Market Simulation

The market simulator exists to make the analytics product dynamic.

It is not intended to model real markets accurately.

It should generate believable product behavior.

Possible model:

```text
Asset
 ├── symbol
 ├── base price
 ├── current price
 ├── volatility
 ├── trend
 └── tick interval
```

---

# 37. Market Modes

Recommended modes:

```text
Paused
Normal
Volatile
Bullish
Bearish
```

An additional deterministic scenario mode should be available.

---

# 38. Market Tick Lifecycle

Conceptually:

```text
Market engine
      ↓
Generate price tick
      ↓
Validate event
      ↓
Publish event
      ↓
Realtime adapter
      ↓
Application state
      ↓
Portfolio calculations
      ↓
UI
```

The same conceptual flow should be used by the real implementation where applicable.

---

# 39. Market Scenarios

Recommended deterministic scenarios:

```text
Stable Market
Bullish Session
Volatile Session
Sharp Drawdown
Recovery
```

Each scenario should define:

- starting state;
- event sequence;
- timing;
- expected behavior.

---

# 40. Simulation Clock

Time-dependent simulation may use a controlled clock.

This allows:

- accelerated demonstrations;
- deterministic testing;
- controlled job progression;
- predictable alert triggering;
- repeatable market scenarios.

Real wall-clock time should not be the only mechanism controlling simulations.

---

# 41. Background Jobs

The demo should simulate asynchronous background jobs where appropriate.

Examples:

- analytics recalculation;
- report generation;
- data import;
- export generation;
- portfolio synchronization.

Lifecycle:

```text
queued
 ↓
running
 ↓
progress
 ↓
completed
```

Failure lifecycle:

```text
queued
 ↓
running
 ↓
failed
 ↓
retrying
 ↓
completed
```

---

# 42. Job Progress

Progress must be tied to job state.

Example:

```text
0%
25%
50%
75%
100%
```

Do not animate progress independently of the simulated job.

---

# 43. Job Cancellation

Where the real product supports cancellation, the demo should simulate it.

Conceptually:

```text
Running
 ↓
Cancel
 ↓
Cancelling
 ↓
Cancelled
```

If cancellation is not a meaningful real product capability, it should not be added solely for demonstration.

---

# 44. Notifications

Notifications should be generated by meaningful product events.

Examples:

```text
Transaction completed
Portfolio updated
Price alert triggered
Report ready
Connection restored
Operation failed
Retry succeeded
```

Notifications should follow the UI/UX specification.

---

# 45. Alert Simulation

Alerts should respond to state transitions.

Example:

```text
Current price
      ↓
Threshold evaluation
      ↓
Condition crossed
      ↓
Alert triggered
      ↓
Notification
```

The system must prevent repeated alerts on every tick while the condition remains continuously true.

---

# 46. Transaction Simulation

A simulated transaction must pass through the application architecture.

Expected flow:

```text
Form
 ↓
Client validation
 ↓
Application command
 ↓
Transaction service
 ↓
Simulated latency
 ↓
Business validation
 ↓
Repository mutation
 ↓
Portfolio recalculation
 ↓
Realtime event
 ↓
Notification
```

This flow is important because it demonstrates real application behavior.

---

# 47. Transaction Validation

Possible validation scenarios:

```text
Missing required field
Invalid quantity
Invalid price
Invalid symbol
Insufficient simulated cash
Unsupported operation
```

Validation should exist at both appropriate client and application/domain boundaries.

---

# 48. Duplicate Submission

The demo should prevent accidental duplicate transaction submissions.

Possible mechanisms:

- disabled submit state;
- mutation state;
- idempotency key;
- duplicate detection.

The final mechanism should be selected based on the real architecture.

---

# 49. Conflict Simulation

Where appropriate, the demo may simulate concurrent modification.

Example:

```text
Edit portfolio
 ↓
State changes elsewhere
 ↓
Update rejected
 ↓
409 Conflict
 ↓
Explain conflict
 ↓
Refresh/reconcile
```

This should only be included if it reflects a realistic product problem.

---

# 50. Search and Filters

Demo tables must support realistic interactions:

- search;
- filters;
- sorting;
- pagination where appropriate;
- column visibility where appropriate;
- empty results;
- loading;
- errors.

TanStack Table remains the selected solution for complex tabular interfaces.

---

# 51. Analytics

Analytics must be derived from coherent demo data.

Possible analytics:

```text
Portfolio performance
P/L
Allocation
Exposure
Transaction statistics
Win/loss distribution
Historical performance
```

Charts must respond to relevant:

- portfolio selection;
- date ranges;
- filters;
- market changes;
- transaction changes.

---

# 52. Empty States

The demo should deliberately expose useful empty states.

Examples:

```text
No portfolios
Empty portfolio
No transactions
No alerts
No search results
No analytics for range
No active jobs
```

Empty states should explain the state and suggest the next useful action.

---

# 53. Error States

Error states must be contextual.

The UI should distinguish between:

```text
Validation problem
Network problem
Permission problem
Not found
Conflict
Server failure
Realtime failure
```

A generic "Something went wrong" message alone is insufficient when the application can provide more useful information.

---

# 54. Error Boundaries

Unexpected UI errors should be contained.

Conceptual behavior:

```text
Unexpected error
 ↓
Error boundary
 ↓
Fallback
 ↓
Retry / Navigate / Reset
```

Expected API failures should normally be handled through query/mutation/application error handling.

---

# 55. Demo Authentication

The public demo should not require registration.

A controlled demo identity should be created automatically.

Example:

```text
Enter Demo
 ↓
Create demo session
 ↓
Load demo user
 ↓
Initialize state
```

No real credentials should be requested.

---

# 56. Demo RBAC

The demo may demonstrate role-based access control.

Possible roles:

```text
Viewer
Trader
Admin
```

Example:

```text
Viewer
  → read-only

Trader
  → read + supported mutations

Admin
  → demo configuration / simulation controls
```

The exact permission matrix must follow the authentication/authorization specification.

---

# 57. Security Boundary

Demo mode must not disable authorization architecture.

Avoid:

```text
if (demo) allowEverything();
```

Instead:

```text
Demo identity
 ↓
Role
 ↓
Permission check
 ↓
Application operation
```

This keeps the security model demonstrable.

---

# 58. Public Demo Safety

The demo must never:

- execute real trades;
- connect to brokerage accounts;
- request real financial credentials;
- expose API keys;
- access production databases;
- access production authentication;
- modify real data.

All financial operations are simulated.

---

# 59. Demo Isolation

Demo configuration must make production access difficult or impossible.

The demo must use:

```text
Demo repositories
Demo services
Demo persistence
Demo session
```

It must not silently fall back to real infrastructure if a demo dependency is missing.

Fail closed.

---

# 60. External Network Access

The default demo should not require external runtime requests.

Preferred:

```text
Bundled assets
Bundled mock data
Browser APIs
Local simulation
```

Avoid:

```text
External market APIs
Paid services
Remote WebSocket providers
Remote databases
```

This ensures the demo remains free and predictable.

---

# 61. Offline Behavior

Because the core demo is local, the product should remain usable after its static assets have loaded even if the network becomes unavailable.

The network simulation can intentionally force offline states to demonstrate recovery.

Optional browser caching may be added later.

A full PWA is not required by this specification.

---

# 62. Demo Controls

A dedicated simulation control surface should be available for technical reviewers.

Possible sections:

```text
Demo
 ├── Status
 └── Reset

Market
 ├── Pause
 ├── Resume
 ├── Speed
 └── Scenario

Network
 ├── Normal
 ├── Slow
 ├── Offline
 └── Timeout

Failures
 ├── Validation Error
 ├── Server Error
 ├── Timeout
 └── Realtime Disconnect

Jobs
 ├── Start
 ├── Fail
 ├── Retry
 └── Complete
```

The exact controls should be based on actual implemented scenarios.

---

# 63. Demo Controls Visibility

Normal visitors should not be required to interact with simulation controls.

Possible approaches:

```text
Demo Controls button
```

or:

```text
Reviewer / Simulation panel
```

The control surface should remain discoverable without dominating the product.

---

# 64. Visual Separation

Simulation controls must be visually distinct from product controls.

They must not look like:

- buy buttons;
- sell buttons;
- account actions;
- real financial controls.

The UI must clearly communicate:

> This is a simulation.

---

# 65. Demo Indicator

A subtle indicator should identify demo mode.

Possible locations:

- application shell;
- top navigation;
- profile/session area;
- environment badge.

The indicator should establish trust without dominating the interface.

---

# 66. Performance

Simulation must be efficient.

Realtime updates should consider:

- batching;
- throttling;
- selective subscriptions;
- memoization;
- normalized state;
- bounded histories.

The simulation must not create artificial performance problems.

---

# 67. Memory Management

Long-running demo sessions must not continuously accumulate:

- timers;
- event listeners;
- market ticks;
- notifications;
- completed jobs;
- stale subscriptions.

All subscriptions and timers must have lifecycle cleanup.

---

# 68. Bounded History

Historical simulation data should be bounded.

Examples:

```text
Last N market ticks
Last N notifications
Recent jobs only
```

Exact limits will be determined during implementation.

---

# 69. Simulation Lifecycle

The demo engine should expose a predictable lifecycle:

```text
created
 ↓
initialized
 ↓
running
 ↓
paused
 ↓
resumed
 ↓
stopped
```

Reset should stop and recreate the simulation cleanly.

---

# 70. Cleanup

On unmount or shutdown, the demo must clean up:

- timers;
- intervals;
- event listeners;
- subscriptions;
- pending requests;
- simulated WebSocket connections;
- background job timers.

This is required for correct SPA behavior and testing.

---

# 71. Scenario Model

Scenarios should be reusable.

Conceptual interface:

```ts
interface DemoScenario {
  id: string;
  name: string;
  description: string;
  seed: string;
  setup(): Promise<void>;
  run(): Promise<void>;
  reset(): Promise<void>;
}
```

The exact implementation can differ.

---

# 72. Recommended Scenarios

At minimum, the demo should support scenarios covering:

```text
Successful transaction
Transaction validation failure
Server error + retry
Realtime disconnect + reconnect
Market volatility
Alert trigger
Background job success
Background job failure + retry
Reset
```

---

# 73. Scenario Composition

Scenarios may combine simulation capabilities.

Example:

```text
Volatile Market
 +
Price Alert
 +
Notification
```

However, scenario complexity should remain manageable.

The goal is reproducibility, not an elaborate simulation framework.

---

# 74. Scenario Documentation

Each scenario should document:

```text
Purpose
Initial state
Trigger
Expected behavior
Recovery
Reset behavior
```

This documentation should live in the repository.

---

# 75. Developer Diagnostics

Optional local diagnostics may expose:

```text
Demo engine status
Current scenario
Current seed
Active latency
Failure mode
Realtime state
Active jobs
Event count
```

These are development/reviewer tools and do not need to be exposed to ordinary visitors.

---

# 76. Structured Logging

Development logs should use structured information where useful.

Example:

```text
[demo]
operation=portfolio.list
latency=420ms
status=success
```

Logs must not include sensitive information.

Public builds should minimize unnecessary logging.

---

# 77. Observability Boundary

Demo diagnostics must not require paid third-party observability services.

Local diagnostics are sufficient for the demo.

The full observability strategy is defined separately in:

```text
13-observability-spec.md
```

---

# 78. Testability

Every demo subsystem should be testable independently.

Tests should cover:

- repositories;
- services;
- simulation;
- scenarios;
- failures;
- latency;
- reset;
- persistence;
- realtime;
- background jobs;
- recovery.

---

# 79. Unit Test Examples

Unit tests should cover:

```text
Price generation
Scenario transitions
Failure selection
Latency profiles
Retry decisions
Alert transitions
Job transitions
Reset behavior
Persistence serialization
```

---

# 80. Integration Test Examples

Integration tests should verify:

```text
Transaction
 → repository
 → portfolio update

Market event
 → realtime adapter
 → application
 → position update

Alert condition
 → alert service
 → notification

Failure
 → error state
 → retry
 → success

Reset
 → repositories
 → persistence
 → simulation
```

---

# 81. E2E Test Examples

Critical flows should be covered with E2E tests.

Minimum scenarios:

```text
Enter demo
Create portfolio
Create transaction
See updated portfolio
Filter positions
Trigger alert
Disconnect realtime
Reconnect
Retry failed request
Run background job
Reset demo
```

Exact E2E coverage will be finalized in the implementation phase.

---

# 82. Accessibility

Demo-only controls must meet the same accessibility requirements as the main product.

Required:

- keyboard navigation;
- focus management;
- semantic controls;
- accessible labels;
- status announcements where necessary;
- reduced-motion support;
- sufficient contrast;
- non-color-only status indication.

---

# 83. Responsive Demo Controls

On smaller screens:

- simulation controls may become a drawer;
- advanced controls may be grouped;
- dense controls may be collapsible;
- reset actions must remain easy to find;
- destructive operations must remain deliberate.

The core product must remain usable.

---

# 84. Demo Performance Budget

Performance must be measured rather than assumed.

Relevant measurements:

```text
Initial load
JavaScript payload
Interaction latency
Table rendering
Chart rendering
Realtime update cost
Memory growth
```

No performance numbers should be included in the final case study until measured.

---

# 85. No Invented Results

The following are examples of claims that must not be included unless actually measured:

```text
95+ Lighthouse
Sub-100ms response
60 FPS
99.9% uptime
40% less rendering
```

Simulation values must never be presented as measured application performance.

---

# 86. Implementation Constraints

The demo must not:

- duplicate complete feature logic;
- hard-code responses inside components;
- bypass validation;
- bypass authorization;
- hide errors;
- rely on uncontrolled randomness;
- require paid services;
- require manual database setup;
- depend on live market data;
- access production infrastructure.

---

# 87. Abstraction Trade-off

A common risk is turning the demo into a duplicate backend.

This must be avoided.

The target is:

```text
Shared product behavior
+
shared domain/application logic
+
replaceable infrastructure
```

not:

```text
Real backend
+
complete fake backend
```

The demo should simulate infrastructure rather than rebuild the entire production system.

---

# 88. Responsibility Matrix

| Responsibility | Real Mode | Demo Mode |
|---|---|---|
| UI | Shared | Shared |
| Feature logic | Shared | Shared |
| Domain rules | Shared | Shared |
| Application use cases | Shared | Shared |
| Repository contracts | Shared | Shared |
| Database | PostgreSQL | Local/mock state |
| API | Real Express API | Mock adapter/API |
| Market data | Real adapter | Market simulation |
| Realtime | WebSocket | Local realtime simulator |
| Authentication | JWT + RBAC | Controlled demo identity |
| Background jobs | Real worker/process | Local job simulator |
| Persistence | PostgreSQL | Browser/local storage |
| Failures | Real operational failures | Controlled injection |
| Reset | Not applicable | First-class feature |

---

# 89. Interview Demonstration Flow

The demo should support a concise technical walkthrough:

```text
1. Enter Demo
2. Explain dashboard
3. Select portfolio
4. Inspect positions
5. Demonstrate table filtering
6. Create simulated transaction
7. Show portfolio recalculation
8. Trigger market simulation
9. Show realtime P/L update
10. Disconnect realtime
11. Show reconnecting state
12. Inject server failure
13. Retry successfully
14. Start background job
15. Show progress
16. Reset demo
```

This flow must be reproducible.

---

# 90. Visitor Experience

A normal visitor should not need to understand:

- repository patterns;
- dependency injection;
- event buses;
- simulation engines;
- adapters.

They should experience:

```text
A coherent trading analytics product.
```

The architectural complexity should remain behind the interface.

> **Complex under the hood, simple in the hands of the user.**

---

# 91. Developer Experience

A developer should be able to:

- start demo mode quickly;
- reset state;
- select scenarios;
- inject failures;
- inspect simulation state;
- inspect events;
- reproduce issues;
- run tests;
- switch to real infrastructure;
- understand the infrastructure boundary.

---

# 92. Repository Documentation

The repository must document:

```text
How to run demo mode
How to reset state
How to access simulation controls
Available scenarios
Available failure injections
Mock adapter architecture
Infrastructure switching
Seed behavior
Adding a new scenario
Testing simulation behavior
```

The public case study should explain the architecture at a higher level rather than exposing every implementation detail.

---

# 93. Demo Build

The public demo build should:

- bundle required demo data;
- avoid production credentials;
- avoid unnecessary infrastructure;
- avoid external service requirements;
- include intended simulation functionality;
- remain optimized for public delivery.

Deployment specifics belong to `14-deployment-spec.md`.

---

# 94. Environment Validation

Application startup should follow:

```text
Read environment
 ↓
Validate configuration
 ↓
Determine runtime mode
 ↓
Create infrastructure
 ↓
Initialize demo engine
 ↓
Initialize session
 ↓
Start application
```

Invalid demo configuration should fail safely and provide useful developer diagnostics.

---

# 95. Demo Initialization

Recommended sequence:

```text
1. Load configuration
2. Determine demo mode
3. Initialize seed
4. Create mock repositories
5. Restore valid local state
6. Initialize simulation engine
7. Initialize realtime adapter
8. Initialize demo session
9. Start required simulations
10. Render application
```

Initialization must be deterministic.

---

# 96. Demo Shutdown

The demo must clean up all active resources when stopped.

Required cleanup includes:

```text
Timers
Intervals
Subscriptions
Event listeners
Pending operations
Simulated connections
Background job timers
```

---

# 97. Definition of Done

The demo implementation is complete when:

- the application can run publicly without paid infrastructure;
- the demo starts with coherent deterministic data;
- primary product flows are functional;
- application logic is shared with real mode;
- mock infrastructure implements application contracts;
- loading states work;
- empty states work;
- error states work;
- validation works;
- retry works;
- realtime simulation works;
- realtime disconnection works;
- reconnection works;
- market simulation works;
- alerts work;
- background jobs work;
- job progress works;
- local persistence works where appropriate;
- reset restores the initial state;
- demo state is isolated;
- no production credentials are required;
- no real financial operations are possible;
- failure injection is reproducible;
- critical scenarios are covered by automated tests;
- accessibility requirements are respected;
- responsive behavior is respected;
- no unverified performance claims are made.

---

# 98. Relationship With Other SDDs

This document extends:

```text
00-overview.md
01-product-spec.md
02-functional-requirements.md
03-non-functional-requirements.md
04-tech-stack.md
05-architecture.md
06-api-spec.md
07-realtime-spec.md
10-testing-strategy.md
11-ui-ux-spec.md
```

It provides requirements for:

```text
13-observability-spec.md
14-deployment-spec.md
15-implementation-plan.md
```

The implementation plan must treat this document as the authoritative specification for demo behavior.

---

# 99. Final Architecture Principle

The public demo is not a disposable presentation layer.

It is a runtime configuration of the same product.

```text
                  TRADING ANALYTICS PLATFORM
                           │
             ┌─────────────┴─────────────┐
             │                           │
        REAL RUNTIME                DEMO RUNTIME
             │                           │
      Real infrastructure        Mock infrastructure
             │                           │
      PostgreSQL / API            Local state / mocks
      WebSocket / workers         Simulation / scenarios
             │                           │
             └─────────────┬─────────────┘
                           │
                    Shared application
                           │
                    Shared domain rules
                           │
                       Shared UI
```

The infrastructure changes.

The product does not.

The demo should therefore feel real because it preserves the behavior and architecture of the real product while replacing expensive or unavailable infrastructure with deterministic, isolated, testable simulation.

> **The demo is not a shortcut around the architecture. The demo is one of the ways the architecture is demonstrated.**
