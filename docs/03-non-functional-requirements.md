# Trading Analytics Platform
## SDD — 03. Non-Functional Requirements

**Status:** Draft  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`

---

# 1. Purpose

This document defines the non-functional requirements for Trading Analytics Platform.

While the functional requirements define **what the system does**, this document defines **how well the system must do it**.

The requirements cover:

- performance;
- scalability;
- reliability;
- maintainability;
- security;
- accessibility;
- developer experience;
- observability;
- testability;
- resilience;
- deployment;
- cost efficiency.

The requirements apply to both:

- the full-stack application;
- the public demo, where applicable.

---

# 2. Engineering Philosophy

The system should demonstrate production-oriented engineering without introducing unnecessary infrastructure complexity.

The architecture should favor:

```text
Simple
   ↓
Well-defined
   ↓
Composable
   ↓
Testable
   ↓
Scalable
```

rather than:

```text
Complex
   ↓
Distributed
   ↓
Expensive
   ↓
Difficult to maintain
```

A technology or architectural pattern must have a clear engineering justification.

---

# 3. Requirement Priorities

### P0 — Critical

Failure directly compromises the product.

### P1 — Required

Important for a production-quality implementation.

### P2 — Valuable

Improves quality but does not block the initial release.

### P3 — Future

Potential evolution beyond the initial implementation.

---

# 4. Performance

## NFR-001 — Initial Application Load

**Priority:** P0

The public application should achieve a fast initial loading experience under normal network conditions.

### Target

The application should aim for:

- LCP ≤ 2.5s;
- CLS ≤ 0.1;
- INP ≤ 200ms;

under a representative production environment.

These metrics should be evaluated using Lighthouse and/or equivalent browser performance tooling.

### Acceptance criteria

- Initial rendering does not require unnecessary blocking requests.
- Critical UI is available quickly.
- Non-critical resources are deferred where appropriate.

---

## NFR-002 — Route Navigation

**Priority:** P1

Navigation between application views should feel immediate.

### Target

For client-side navigation:

- UI transition should begin within 100ms where technically possible;
- loading indicators should appear when an operation cannot complete immediately.

---

## NFR-003 — Interaction Responsiveness

**Priority:** P0

User interactions must remain responsive during normal application operation.

Examples:

- filtering;
- sorting;
- opening dialogs;
- changing portfolios;
- interacting with charts;
- navigating Decision Replay;
- manipulating Scenario Lab.

Heavy calculations must not unnecessarily block the main UI thread.

---

# 5. Real-Time Performance

## NFR-004 — Market Update Propagation

**Priority:** P1

Simulated market events should propagate through the application efficiently.

### Target

Under normal demo conditions:

> UI-visible price updates should generally propagate within 100ms of receiving the simulated event.

The target refers to application propagation, not external market-data latency.

---

## NFR-005 — Update Stability

**Priority:** P1

Frequent market updates must not cause excessive rendering.

The application should avoid:

- unnecessary global state updates;
- full-page re-renders;
- repeated expensive calculations;
- excessive chart redraws.

---

## NFR-006 — Burst Handling

**Priority:** P2

The system should tolerate short bursts of market events without becoming unusable.

The architecture should support:

- event batching where appropriate;
- throttling;
- selective subscriptions;
- derived-state optimization.

The exact strategy will be defined in the architecture specification.

---

# 6. Data and Calculation Performance

## NFR-007 — Derived Analytics

**Priority:** P1

Analytics calculations should avoid unnecessary recomputation.

Derived values should be recalculated only when relevant source data changes.

Examples:

```text
Transaction changes
        ↓
Position recalculation
        ↓
Portfolio metrics
        ↓
Relevant analytics
```

Unrelated application areas should not be recalculated unnecessarily.

---

## NFR-008 — Large Historical Datasets

**Priority:** P1

Chart and analytics components should remain usable with representative historical datasets.

The implementation should consider:

- data windowing;
- aggregation;
- memoization;
- progressive loading;
- canvas rendering where justified.

---

# 7. Scalability

## NFR-009 — Horizontal Growth

**Priority:** P1

The backend architecture should allow the application to scale beyond a single application instance without requiring a fundamental rewrite.

The architecture should avoid unnecessary in-process assumptions.

Potential future growth should allow:

```text
             Load Balancer
                  │
       ┌──────────┼──────────┐
       ↓          ↓          ↓
   Instance A  Instance B  Instance C
       │          │          │
       └──────────┼──────────┘
                  ↓
        Shared infrastructure
```

The initial deployment does not need to use multiple instances.

---

## NFR-010 — Stateless Application Layer

**Priority:** P1

Where practical, application servers should remain stateless.

Session, cache, and persistent state should not depend exclusively on local process memory in the production architecture.

---

## NFR-011 — Domain Isolation

**Priority:** P1

Application domains should be sufficiently isolated to allow future evolution without widespread coupling.

Primary domains include:

- portfolios;
- positions;
- transactions;
- assets;
- analytics;
- decisions;
- scenarios;
- notifications.

---

## NFR-012 — Data Growth

**Priority:** P1

The data model should support growth in:

- users;
- portfolios;
- positions;
- transactions;
- historical data;
- decisions;
- scenarios.

The application should avoid structures that assume a permanently small dataset.

---

# 8. Reliability

## NFR-013 — Graceful Failure

**Priority:** P0

Expected infrastructure failures must not cause uncontrolled application crashes.

Failures should result in:

- recoverable UI states;
- useful error messages;
- retry where appropriate;
- preservation of valid state.

---

## NFR-014 — Partial Failure Isolation

**Priority:** P1

Failure of one non-critical capability should not unnecessarily disable unrelated functionality.

For example:

```text
Market feed unavailable
        ↓
Portfolio remains accessible
        ↓
Historical analytics remain accessible
```

---

## NFR-015 — Operation Consistency

**Priority:** P0

Business operations affecting multiple dependent entities must preserve data consistency.

For example:

```text
Transaction
   ↓
Position
   ↓
Portfolio
   ↓
Analytics
```

The system must avoid exposing partially updated states after successful mutations.

---

# 9. Resilience

## NFR-016 — Retry Safety

**Priority:** P1

Retries must not unintentionally duplicate state-changing operations.

The architecture should support appropriate mechanisms such as:

- idempotency;
- operation identifiers;
- safe retry policies.

The final strategy will be defined in `05-architecture.md` and `07-api-spec.md`.

---

## NFR-017 — Timeout Handling

**Priority:** P1

External or internal operations that exceed defined time limits must transition into an explicit timeout state.

The user should be informed and provided a recovery path where appropriate.

---

## NFR-018 — Real-Time Reconnection

**Priority:** P1

The real-time client should recover from temporary connection failures where supported.

The implementation should avoid:

- duplicate subscriptions;
- duplicate events;
- uncontrolled reconnect loops.

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