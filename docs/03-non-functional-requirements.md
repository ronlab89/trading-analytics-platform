# SDD 03 — Non-Functional Requirements

**Project:** Trading Analytics Platform  
**Status:** §1-§9 reconciled with the ADRs and the code on 2026-10-05 (task T3.2); later sections Draft  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`

Status values follow the legend in `docs/README.md`. Targets marked
`(proposed)` were added during reconciliation because the requirement had no
number; they are open to revision when their block is planned.

---

# 1. Purpose

**Status:** `Reference`

This document defines **how well** the system must do what
`02-functional-requirements.md` defines. It covers performance, scalability,
reliability, resilience, security, accessibility, maintainability,
developer experience, observability, testability, deployment and cost.

Each requirement applies to the local full stack and, where applicable, to
the static public demo (ADR-006). Every requirement states a target and how
it is checked; where an ADR knowingly limits a requirement, the exception is
written next to it.

---

# 2. Engineering Philosophy

**Status:** `Reference`

Prefer simple, well-defined, composable and testable designs over
distributed or expensive ones. A technology or architectural pattern needs a
clear engineering justification (see NFR-070).

---

# 3. Requirement Priorities

**Status:** `Reference`

| Priority | Meaning |
| --- | --- |
| P0 — Critical | Failure directly compromises the product. |
| P1 — Required | Important for a production-quality implementation. |
| P2 — Valuable | Improves quality but does not block the initial release. |
| P3 — Future | Possible evolution beyond the initial implementation. |

---

# 4. Performance

## NFR-001 — Initial Application Load

**Priority:** P0  
**Status:** `Planned (FE)`

### Target

- LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms.

### Measurement

Lighthouse (mobile preset, simulated throttling) on the production build of
the static demo (ADR-006). The requirement passes when every listed metric
meets its threshold. Non-critical resources are lazy-loaded so the first
view needs no blocking request beyond the application bundle.

---

## NFR-002 — Route Navigation

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

- Visible UI response to a client-side navigation within 100 ms.
- A loading indicator whenever the target view is not ready within
  300 ms `(proposed)`.

### Measurement

Browser performance trace on the production build: time from the click to
the first frame of the new route or of its loading state.

---

## NFR-003 — Interaction Responsiveness

**Priority:** P0  
**Status:** `Planned (FE)`

### Target

- INP ≤ 200 ms (as NFR-001) for filtering, sorting, dialogs, portfolio
  switching, chart interaction, Decision Replay and Scenario Lab.
- No main-thread task longer than 200 ms `(proposed)` during these
  interactions; heavier calculations move off the main thread or are split.

### Measurement

Browser performance trace (Long Tasks) while running each listed
interaction on the seeded dataset.

---

# 5. Real-Time Performance

## NFR-004 — Market Update Propagation

**Priority:** P1  
**Status:** `Planned (B5)` (server); `Planned (FE)` (client)

### Target

UI-visible price updates within 100 ms of the client receiving the
simulated event. The target covers application propagation only, not
market-data latency (all prices are simulated, ADR-007).

### Measurement

Client instrumentation comparing the event receipt time with the next
frame that shows the new price, in both real and demo mode.

---

## NFR-005 — Update Stability

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

A `MARKET_PRICE_UPDATED` event re-renders only components that display the
affected asset or a value derived from it; no full-page re-render and no
redraw of charts that do not plot that asset.

### Measurement

Component tests with render counting (one event → only subscribed
components render), plus a profiler check during continuous ticking.

---

## NFR-006 — Burst Handling

**Priority:** P2  
**Status:** `Planned (B5)` (server limits); `Planned (FE)` (client batching)

### Target

- Server: per-connection subscription limit, inbound message rate limit
  and bounded memory per connection (ADR-007 point 11).
- Client: a burst of 100 events within 1 s `(proposed)` keeps INP
  ≤ 200 ms and is applied in at most one render per animation frame.

### Measurement

Simulator scenario that emits the burst; browser trace on the client and
realtime tests for the server limits (`08-realtime-spec.md`).

---

# 6. Data and Calculation Performance

## NFR-007 — Derived Analytics

**Priority:** P1  
**Status:** `Planned (B1)` (server); `Planned (FE)` (client)

### Target

- Client: derived values recompute only when their source data changes
  (transaction → position → portfolio metrics → analytics); unrelated views
  do not recompute.
- Server: an analytics request over the seeded 90-day history completes
  within 500 ms `(proposed)`, the ADR-009 slow-operation threshold.

### Accepted exception

ADR-004 rebuilds the value series on every request and adds caching only
when measured to be needed. The server therefore does not avoid
recomputation in version 1; it is bounded by the time target instead.

### Measurement

Server: the separate timing of series reconstruction (ADR-009 point 8)
stays under the slow-operation threshold. Client: selector or memo tests
showing no recomputation on unrelated state changes.

---

## NFR-008 — Large Historical Datasets

**Priority:** P1  
**Status:** `Planned (FE)`

### Target

Charts with 5 years of daily points per asset `(proposed)` keep INP
≤ 200 ms and initial chart render ≤ 500 ms `(proposed)`. Techniques
(windowing, aggregation, memoization, progressive loading, canvas) are
chosen per chart in the frontend stage.

### Measurement

Browser trace with a generated 5-year dataset in demo mode.

---

# 7. Scalability

## NFR-009 — Horizontal Growth

**Priority:** P1  
**Status:** `Deferred` (ADR-006)

### Accepted exception

ADR-006 limits version 1 to a single local backend instance and a static
demo; there is no hosted backend. Realtime connections and subscriptions
(ADR-007) and the job runner (ADR-008) are deliberately in-process. No
multi-instance target applies in version 1. Hosting the backend requires a
new ADR, which reopens this requirement.

### What still holds

Persistent state lives in PostgreSQL, not in process memory (see NFR-010).

---

## NFR-010 — Stateless Application Layer

**Priority:** P1  
**Status:** persistent state in PostgreSQL `Implemented`; refresh sessions
`Planned (B2)`; in-process realtime and job runner accepted (ADR-007,
ADR-008)

### Target

All business data, jobs (`jobs` table, ADR-008) and idempotency records
(ADR-008) are stored in PostgreSQL. An API restart loses no persisted
state: jobs left `PROCESSING` become `FAILED` with reason `INTERRUPTED` and
`QUEUED` jobs resume (ADR-008 point 5).

### Accepted exception

Realtime sockets and subscriptions live in process memory (ADR-007); a
restart drops them and clients reconnect and resynchronize (NFR-018).

### Measurement

Restart test for the job runner (B4) and the existing API integration
tests against PostgreSQL.

---

## NFR-011 — Domain Isolation

**Priority:** P1  
**Status:** entities reference other aggregates by ID `Implemented`
(`packages/domain/src/entities`); lint import-boundary rules
`Planned (B0)` (ADR-001 point 1; today only a placeholder in
`eslint.config.js`, see `06-architecture.md` §43)

### Target

Domains (portfolios, positions, transactions, assets, analytics, decisions,
scenarios, notifications) reference each other only by identifier, and
`@trading/domain` depends on no application or infrastructure package
(ADR-001).

### Measurement

Code review today; a lint rule (`no-restricted-imports` or equivalent)
failing the build on a cross-layer import once the deferred check is built.

---

## NFR-012 — Data Growth

**Priority:** P1  
**Status:** paginated lists `Implemented` (transactions, assets); remaining
collections follow the same rule when built

### Target

Every collection endpoint is paginated with a bounded page size (default
20, maximum 100, `apps/api/src/schemas/pagination.schema.ts`). No endpoint
returns an unbounded list.

### Measurement

Request validation rejects `pageSize` above 100; API tests per collection
endpoint.

---

# 8. Reliability

## NFR-013 — Graceful Failure

**Priority:** P0  
**Status:** API error envelope with `requestId` `Implemented`; UI error
states `Planned (FE)`

### Target

- Every API failure returns the standard error envelope with a `requestId`
  (`07-api-spec.md`); no unhandled error terminates the process.
- Every failed UI request shows an error state with a user-readable message
  and, for retryable failures, a retry action; already-loaded valid data
  stays visible.

### Measurement

API tests for each error category (`apps/api/src/middleware/error-handler.ts`);
component tests for error and retry states.

---

## NFR-014 — Partial Failure Isolation

**Priority:** P1  
**Status:** `Planned (B5)` (server); `Planned (FE)` (client)

### Target

With the realtime socket down, portfolios, transactions and historical
analytics remain usable through HTTP; the UI shows a stale-data indicator
and refetches periodically until reconnection (ADR-007 point 12). Analytics
with missing prices return partial results (`16-analytics-spec.md` §16).

### Measurement

Realtime failure test in B5 ("realtime failure degrades to HTTP",
`BACKEND-ROADMAP.md`) and a UI test with the realtime adapter disconnected.

---

## NFR-015 — Operation Consistency

**Priority:** P0  
**Status:** transaction creation `Implemented`; CSV import `Planned (B4)`

### Target

A mutation that changes several entities either commits all of them or
none. Transaction creation writes the transaction, recalculates the
position and marks it `COMPLETED` in one `UnitOfWork`
(`apps/api/src/services/transaction.service.ts`). CSV import applies all
rows in one `UnitOfWork` (ADR-008 point 2).

### Measurement

Integration tests forcing a failure mid-operation and asserting no partial
state (`apps/api/src/routes/transactions.routes.test.ts`; B4 import tests).

---

# 9. Resilience

## NFR-016 — Retry Safety

**Priority:** P1  
**Status:** `Planned (B4)` (ADR-008)

### Target

- Repeating a state-changing request with the same `Idempotency-Key`
  returns the stored response and applies the change once
  (`07-api-spec.md` §39). The key and response are written in the same
  `UnitOfWork` as the mutation; 5xx outcomes are not stored (ADR-008).
- A job retry never imports the same rows twice (ADR-008 point 7).

### Measurement

B4 idempotency tests with duplicate and concurrent submissions.

---

## NFR-017 — Timeout Handling

**Priority:** P1  
**Status:** job timeouts `Planned (B4)`; client request timeouts
`Planned (FE)`

### Target

- Each job type has a timeout per attempt while `QUEUED` or validating;
  exceeding it ends in `TIMED_OUT`, which is retryable (ADR-008 points 6-7).
  The apply stage is exempt.
- Client HTTP requests time out after 15 s `(proposed)` and show a timeout
  state with a retry action.
- Requests slower than 500 ms are logged at `warn` (ADR-009 point 8).

### Measurement

B4 state-transition tests for timeout; client tests with a delayed mock.

---

## NFR-018 — Real-Time Reconnection

**Priority:** P1  
**Status:** `Planned (B5)` (server); `Planned (FE)` (client)

### Target

- Heartbeat: ping/pong every 30 s (ADR-007 point 11); unauthenticated
  sockets close after 5 s (ADR-007 point 2).
- Reconnection uses exponential backoff from 1 s, doubling, capped at
  30 s, with jitter `(proposed)`.
- After reconnecting, the client restores each subscription exactly once.
- A `sequence` gap or a reconnect triggers an HTTP resynchronization;
  events with an already-seen `sequence` are discarded (ADR-007 point 5).

### Accepted exception

No server-side replay buffer in version 1 (ADR-007): missed events are
recovered by HTTP resynchronization, not replayed.

### Measurement

B5 reconnect, duplicate and stale-event tests (`08-realtime-spec.md` §59)
and client tests with a simulated disconnect.

---

# 10. Security

## NFR-019 — Authentication Security

**Priority:** P0

Authentication must follow secure implementation practices.

Credentials must never be exposed through:

- client logs;
- URLs;
- analytics events;
- error messages.

---

## NFR-020 — Authorization

**Priority:** P0

Protected resources must enforce authorization independently of client-side UI restrictions.

The frontend must not be considered a security boundary.

---

## NFR-021 — Input Validation

**Priority:** P0

User-controlled input must be validated at appropriate boundaries.

Validation should exist at:

```text
Client
  +
Server
  +
Domain/business layer where required
```

Client validation must improve UX but must not replace server validation.

---

## NFR-022 — Sensitive Data Handling

**Priority:** P0

Sensitive information must not be unnecessarily persisted or exposed.

The application should follow least-privilege principles.

---

## NFR-023 — Secret Management

**Priority:** P0

Secrets must never be committed to source control.

Environment-specific secrets must be provided through appropriate configuration mechanisms.

---

## NFR-024 — Dependency Security

**Priority:** P1

Project dependencies should be periodically reviewed for known vulnerabilities.

Automated dependency auditing should be incorporated where practical.

---

## NFR-025 — Secure Headers

**Priority:** P1

The deployed application should use appropriate security headers.

The final header configuration will be defined in the deployment/security specifications.

---

# 11. Frontend Security

## NFR-026 — Client Trust Boundary

**Priority:** P0

The frontend must assume that all client-side state can be manipulated.

Security-sensitive decisions must be enforced server-side in the complete application.

---

## NFR-027 — XSS Prevention

**Priority:** P0

User-provided or externally sourced content must be safely rendered.

Unsafe HTML rendering should be avoided unless explicitly sanitized.

---

## NFR-028 — Token Handling

**Priority:** P1

Authentication token storage and transmission must follow the selected authentication architecture's security requirements.

The implementation must minimize exposure to client-side attacks.

---

# 12. Accessibility

## NFR-029 — WCAG Alignment

**Priority:** P1

The application should target WCAG 2.2 AA principles for core workflows.

This includes:

- keyboard access;
- semantic structure;
- focus visibility;
- sufficient contrast;
- accessible forms;
- meaningful labels;
- status communication.

---

## NFR-030 — Keyboard Navigation

**Priority:** P1

Core workflows must be fully usable without a mouse.

This includes:

- navigation;
- forms;
- dialogs;
- filters;
- tables;
- scenario controls;
- replay controls.

---

## NFR-031 — Screen Reader Compatibility

**Priority:** P1

Important application state changes should be communicated appropriately to assistive technologies.

---

## NFR-032 — Reduced Motion

**Priority:** P1

The application must respect `prefers-reduced-motion`.

Motion-dependent experiences must remain understandable without animation.

---

# 13. Maintainability

## NFR-033 — Modular Architecture

**Priority:** P0

The system should be organized around coherent domains and responsibilities.

The architecture should minimize:

- circular dependencies;
- duplicated business logic;
- uncontrolled shared state;
- large monolithic modules.

---

## NFR-034 — Separation of Concerns

**Priority:** P0

The implementation should maintain clear boundaries between:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Infrastructure
```

The exact architectural interpretation will be defined later.

---

## NFR-035 — Reusable Components

**Priority:** P1

Common UI behavior should be implemented through reusable components where reuse provides meaningful value.

Reuse should not result in artificially generic abstractions.

---

## NFR-036 — Shared Business Logic

**Priority:** P0

Business rules must not be duplicated unnecessarily across UI components.

Calculations such as:

- portfolio value;
- P/L;
- allocation;
- attribution;
- scenario impact;

should have well-defined ownership.

---

## NFR-037 — Explicit Dependencies

**Priority:** P1

Modules should depend on explicit interfaces/contracts rather than implementation details wherever appropriate.

---

# 14. Code Quality

## NFR-038 — Type Safety

**Priority:** P0

The TypeScript codebase should use strict typing.

Avoid unnecessary:

- `any`;
- unsafe casts;
- duplicated type definitions;
- implicit contracts.

---

## NFR-039 — Linting

**Priority:** P1

The project should use automated linting to detect common problems and maintain consistency.

---

## NFR-040 — Formatting

**Priority:** P1

Code formatting should be automated and consistent.

Formatting should not depend on manual developer discipline.

---

## NFR-041 — Static Analysis

**Priority:** P1

Static analysis should identify:

- code smells;
- complexity issues;
- duplicated logic;
- potential bugs;
- maintainability problems.

---

# 15. Testability

## NFR-042 — Deterministic Business Logic

**Priority:** P0

Core business calculations should be deterministic and independently testable.

Examples:

- P/L;
- allocation;
- attribution;
- portfolio value;
- scenario calculations;
- pulse classifications.

---

## NFR-043 — Testable Services

**Priority:** P0

Application services should be testable independently of UI rendering.

---

## NFR-044 — Mockable Infrastructure

**Priority:** P0

External infrastructure should be replaceable with mocks or test implementations.

This requirement is particularly important for the public demo.

---

## NFR-045 — Demo Determinism

**Priority:** P1

The demo should provide predictable seeded data and reproducible behavior where required.

Randomness must not make important workflows impossible to reproduce.

---

# 16. Developer Experience

## NFR-046 — Local Setup

**Priority:** P0

A developer should be able to start the project locally using documented steps.

The setup should minimize unnecessary manual configuration.

---

## NFR-047 — Environment Configuration

**Priority:** P1

Environment-specific configuration must be clearly separated.

At minimum, the project should distinguish:

- development;
- test;
- demo;
- production.

---

## NFR-048 — Development Documentation

**Priority:** P1

The repository must contain enough documentation for another developer to understand:

- how to run the project;
- architecture;
- environment configuration;
- testing;
- build process;
- deployment;
- important engineering decisions.

---

# 17. Observability

## NFR-049 — Structured Logging

**Priority:** P1

The backend should provide structured logs for relevant application events.

Logs should include useful context without exposing sensitive information.

---

## NFR-050 — Error Tracking

**Priority:** P1

Application errors should be identifiable through logs or an appropriate error-tracking mechanism.

The initial free deployment may use lightweight or self-hosted approaches.

No paid observability service is required.

---

## NFR-051 — Health Checks

**Priority:** P1

The backend should expose appropriate health information.

Health checks should distinguish, where practical:

```text
Application healthy
Dependencies healthy
Application degraded
Application unavailable
```

---

# 18. Deployment and Infrastructure

## NFR-052 — Free-Tier Compatibility

**Priority:** P0

The initial production/demo deployment must be designed to operate without paid infrastructure.

The architecture should prioritize services with viable free tiers or free self-hosted alternatives.

---

## NFR-053 — No Required Paid APIs

**Priority:** P0

The public demo must not require paid external APIs to function.

If external market data is eventually supported, it must be optional rather than a hard dependency of the public demo.

---

## NFR-054 — Resource Efficiency

**Priority:** P1

The system should minimize unnecessary consumption of:

- CPU;
- memory;
- bandwidth;
- database operations;
- real-time connections.

This is particularly important for free-tier deployment.

---

## NFR-055 — Deployment Reproducibility

**Priority:** P1

Deployment should be reproducible from the repository configuration.

Environment-specific values must not be manually embedded into application code.

---

# 19. Demo Architecture Constraints

## NFR-056 — Infrastructure Substitution

**Priority:** P0

The demo must be able to substitute real infrastructure with mock implementations without requiring significant UI rewrites.

Conceptually:

```text
                Application
                     │
              Repository/API
                     │
             ┌───────┴───────┐
             ↓               ↓
        Real Adapter      Mock Adapter
```

---

## NFR-057 — Same Contracts

**Priority:** P0

Where practical, mock implementations should conform to the same contracts/interfaces expected by real implementations.

This ensures that:

```text
UI
 ↓
Application logic
 ↓
Contract
 ↓
Real / Mock implementation
```

remains consistent.

---

## NFR-058 — Demo Isolation

**Priority:** P1

Demo-specific behavior must not contaminate the production architecture.

Mock generators, seeded data, simulation controls, and failure injection should be isolated.

---

# 20. Data Simulation Quality

## NFR-059 — Realistic Dataset

**Priority:** P1

Mock data must represent realistic relationships.

For example:

```text
Portfolio
 ├── Positions
 │     └── Assets
 │
 ├── Transactions
 │
 ├── Decisions
 │
 └── Scenarios
```

Relationships must remain internally consistent.

---

## NFR-060 — Edge Cases

**Priority:** P1

The mock dataset must contain sufficient edge cases to exercise:

- empty states;
- negative performance;
- positive performance;
- extreme values;
- missing optional data;
- large datasets;
- failed operations.

---

# 21. UX Quality

## NFR-061 — Perceived Performance

**Priority:** P1

The product should provide immediate feedback even when operations take time.

Appropriate techniques may include:

- optimistic updates;
- skeleton states;
- progressive rendering;
- contextual loading;
- transitions.

These should only be used when they accurately represent application behavior.

---

## NFR-062 — Motion Performance

**Priority:** P1

Animations should avoid causing unnecessary layout recalculation or excessive main-thread work.

Motion should prioritize performant properties such as:

- transform;
- opacity.

---

# 22. Browser Compatibility

## NFR-063 — Modern Browser Support

**Priority:** P1

The application should support current versions of major modern browsers.

At minimum:

- Chrome/Chromium;
- Firefox;
- Safari;
- Edge.

Exact supported versions may be refined during implementation.

---

# 23. SEO and Public Surface

## NFR-064 — Public Project Pages

**Priority:** P1

Public-facing project pages should provide appropriate:

- metadata;
- semantic structure;
- social sharing information;
- canonical URLs where required.

---

## NFR-065 — Private Application Surface

**Priority:** P1

Authenticated application screens should not be treated as primary SEO content.

The public portfolio project page and the application demo should have clearly separated purposes.

---

# 24. Internationalization

## NFR-066 — Localization Support

**Priority:** P1

The application architecture should allow future support for multiple languages without duplicating application logic.

User-facing strings should not be tightly coupled to business logic.

---

# 25. Cost Constraints

## NFR-067 — Zero Required Operating Cost

**Priority:** P0

The initial project must be operable without recurring paid services.

The architecture must therefore avoid hard dependencies on:

- paid market data;
- paid databases;
- paid authentication providers;
- paid observability;
- paid AI APIs;
- paid real-time infrastructure.

---

## NFR-068 — Graceful Free-Tier Degradation

**Priority:** P1

If a selected free service has usage limits, the application should degrade gracefully rather than fail unexpectedly.

Examples:

- reduced real-time frequency;
- limited seeded dataset;
- controlled demo sessions;
- cached information.

---

# 26. Portfolio Engineering Quality

## NFR-069 — Defensible Architecture

**Priority:** P0

Architectural decisions must have a documented rationale.

Each significant decision should answer:

```text
Problem
↓
Options considered
↓
Decision
↓
Trade-offs
↓
Result
```

This documentation should support technical interview discussion.

---

## NFR-070 — Avoid Artificial Complexity

**Priority:** P0

The system must not introduce:

- microservices;
- event buses;
- distributed systems;
- advanced infrastructure;
- unnecessary libraries;

solely to appear more senior.

Complexity must correspond to an actual requirement.

---

## NFR-071 — Evolution Readiness

**Priority:** P1

The architecture should make reasonable future evolution possible without requiring premature implementation.

Potential evolution includes:

```text
Mock Market Data
      ↓
Optional Real Market Data

Single Instance
      ↓
Multiple Instances

Local/Free Observability
      ↓
Production Observability

Basic Analytics
      ↓
Advanced Analytics
```

---

# 27. Quality Gates

The initial release should not be considered complete unless the following quality gates are satisfied.

### Performance

- No obvious blocking performance problems.
- Core interactions remain responsive.
- Real-time updates do not cause uncontrolled rendering.

### Security

- No secrets committed.
- Input validation implemented.
- Authorization enforced server-side.
- Sensitive data appropriately handled.

### Accessibility

- Core flows keyboard accessible.
- Focus states visible.
- Forms accessible.
- Important dynamic feedback communicated appropriately.
- Reduced-motion behavior implemented.

### Maintainability

- Clear domain boundaries.
- Strict TypeScript.
- Automated linting/formatting.
- No significant duplicated business logic.

### Reliability

- Recoverable failures handled.
- Retry paths available where appropriate.
- Dependent state remains consistent.

### Demo

- Complete functional experience.
- Mock infrastructure isolated.
- Realistic seeded data.
- Reproducible error states.
- Reset capability.
- No required paid services.

---

# 28. Non-Functional Success Criteria

The system should demonstrate that it can be:

```text
Fast
  +
Reliable
  +
Secure
  +
Accessible
  +
Maintainable
  +
Testable
  +
Observable
  +
Cost-efficient
```

without relying on unnecessary infrastructure complexity.

The target is not to demonstrate the largest possible system.

The target is to demonstrate **sound engineering judgment**.

---

# 29. Engineering Quality Model

The project should optimize for:

```text
              PRODUCT VALUE
                   ▲
                   │
                   │
       ┌───────────┼───────────┐
       │           │           │
   UX QUALITY   ENGINEERING   RELIABILITY
       │           │           │
       └───────────┼───────────┘
                   │
             SUSTAINABILITY
```

A technically sophisticated architecture that produces a poor user experience is not considered successful.

Likewise, an attractive interface built on fragile architecture is not considered successful.

The system must balance both.

---

# 30. Final Principle

Non-functional requirements exist to constrain engineering decisions, not to justify complexity.

The project should consistently ask:

> **What problem are we solving, what constraint does it create, and what is the simplest architecture that solves it well?**

This principle should guide the architecture, implementation, testing, deployment, and future evolution of Trading Analytics Platform.