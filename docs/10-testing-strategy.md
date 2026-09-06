# Trading Analytics Platform
## SDD — 10. Testing Strategy

**Status:** Draft  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`, `05-data-model.md`, `06-architecture.md`, `07-api-spec.md`, `08-realtime-spec.md`, `09-security-spec.md`

---

# 1. Purpose

This document defines the testing strategy for Trading Analytics Platform.

Testing must verify not only that individual functions work, but that the complete product behaves correctly across:

- user flows;
- business rules;
- API communication;
- validation;
- authentication;
- authorization;
- realtime updates;
- background processes;
- simulation;
- error recovery;
- animations and transitions where behaviorally relevant;
- responsive interactions;
- accessibility;
- performance-critical scenarios.

The public demo must be fully functional despite using mock infrastructure.

---

# 2. Testing Philosophy

The project follows a risk-based testing strategy.

Testing effort should increase with:

- business impact;
- architectural complexity;
- frequency of execution;
- security sensitivity;
- realtime sensitivity;
- likelihood of regression.

The objective is not maximum test count.

The objective is **high confidence in important product behavior**.

---

# 3. Testing Pyramid

The project should follow:

```text
                 ┌─────────────────────┐
                 │   E2E / Playwright   │
                 │  Critical User Flows │
                 └──────────┬──────────┘
                            │
                 ┌──────────▼──────────┐
                 │ Integration Tests   │
                 │ API / DB / Realtime │
                 └──────────┬──────────┘
                            │
              ┌─────────────▼─────────────┐
              │     Component Tests       │
              │ React + User Interaction  │
              └─────────────┬─────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │              Unit Tests                │
        │ Domain / Services / Utilities / Rules  │
        └───────────────────────────────────────┘
```

Most tests should exist at the unit and component levels.

A smaller number of integration and E2E tests should validate complete system behavior.

---

# 4. Testing Layers

The project uses five primary testing layers:

1. Static verification
2. Unit testing
3. Component testing
4. Integration testing
5. End-to-end testing

Additional specialized testing covers:

- security;
- accessibility;
- realtime behavior;
- performance;
- simulation determinism.

---

# 5. Static Verification

Every change should pass:

```text
TypeScript
   ↓
Lint
   ↓
Formatting Check
   ↓
Build
```

Required checks:

- TypeScript type checking;
- ESLint;
- Prettier validation;
- production build.

Static checks should run before automated behavioral tests in CI.

---

# 6. Unit Testing

Vitest is the primary unit testing framework.

Unit tests should focus on deterministic logic with minimal infrastructure.

Priority areas:

- domain entities;
- calculations;
- validation;
- portfolio metrics;
- transaction rules;
- permission rules;
- simulation logic;
- formatting utilities;
- state transformations;
- event normalization.

---

# 7. Domain Testing

Domain logic must have strong unit-test coverage.

Examples include:

```text
Portfolio valuation
Position calculation
Profit / loss calculation
Allocation percentages
Transaction validation
Risk calculations
Alert conditions
Scenario calculations
```

Domain tests should not require React, Express, PostgreSQL, or browser APIs.

---

# 8. Business Rule Testing

Business rules should be tested through explicit examples.

Example:

```text
Given:
  portfolio balance = 10,000
  transaction value = 8,000

When:
  transaction is created

Then:
  transaction is accepted
```

And:

```text
Given:
  portfolio balance = 10,000
  transaction value = 12,000

When:
  transaction is created

Then:
  transaction is rejected
```

Both valid and invalid paths must be tested.

---

# 9. Boundary Testing

Important calculations must test boundary values.

Examples:

- zero;
- minimum allowed value;
- maximum allowed value;
- exact available balance;
- value above available balance;
- empty datasets;
- one item;
- large datasets;
- negative values where prohibited;
- decimal precision.

---

# 10. Component Testing

Testing Library should be used for React component behavior.

Tests should simulate user behavior rather than internal implementation details.

Examples:

```text
click
type
select
submit
toggle
navigate
retry
cancel
confirm
```

The test should verify the resulting user-visible behavior.

---

# 11. Component Test Priorities

High-value components include:

- portfolio selector;
- transaction forms;
- filters;
- data tables;
- charts;
- alerts;
- dialogs;
- notification center;
- realtime status indicator;
- simulation controls;
- scenario panels;
- authentication UI.

Purely visual primitives do not require exhaustive individual tests when their behavior is already covered through composed components.

---

# 12. Form Testing

Forms must test:

- initial state;
- valid submission;
- required fields;
- invalid formats;
- boundary values;
- server validation errors;
- duplicate submissions;
- loading state;
- successful submission;
- cancellation;
- reset behavior.

Example:

```text
User
 ↓
Fill form
 ↓
Submit
 ↓
Validation
 ↓
API
 ↓
Success / Error
 ↓
UI Feedback
```

---

# 13. Error State Testing

Every major asynchronous operation should have tests for:

```text
Idle
Loading
Success
Empty
Error
Retrying
Recovered
```

Where applicable:

```text
Timeout
Unauthorized
Forbidden
Conflict
Rate Limited
Network Offline
```

The UI must provide an intentional experience for each state.

---

# 14. Loading State Testing

Loading states must be tested as behavior.

Examples:

- submit button disabled during request;
- duplicate submission prevented;
- skeleton displayed;
- progress indicator updated;
- stale data behavior remains intentional;
- loading state clears after success or failure.

---

# 15. Empty State Testing

The application must distinguish between:

```text
No data exists
```

and:

```text
Data failed to load
```

Empty-state tests should verify that the correct message and action are displayed.

---

# 16. API Integration Testing

API integration tests should verify the interaction between:

```text
HTTP
 ↓
Middleware
 ↓
Validation
 ↓
Application Service
 ↓
Repository
```

Tests should cover:

- request validation;
- response structure;
- status codes;
- authentication;
- authorization;
- business errors;
- persistence behavior.

---

# 17. Repository Testing

Repositories should be tested independently from application services.

When using PostgreSQL:

- migrations must be applied;
- queries must execute against a controlled test database;
- relationships must be verified;
- transaction behavior must be tested.

Repository tests must not depend on production data.

---

# 18. Mock Repository Testing

Mock repositories must implement the same contracts as production repositories.

Tests should verify behavioral equivalence for important operations.

Example:

```text
ProductionRepository
        │
        ├── createPortfolio()
        ├── getPortfolio()
        └── updatePortfolio()

MockRepository
        │
        ├── createPortfolio()
        ├── getPortfolio()
        └── updatePortfolio()
```

The frontend must not need different business logic because the repository is mocked.

---

# 19. Demo Mode Testing

The public demo is a first-class application mode.

It must not be treated as a simplified visual prototype.

Demo Mode must support:

- navigation;
- authentication simulation;
- portfolio management;
- transactions;
- analytics;
- tables;
- charts;
- realtime simulation;
- alerts;
- background processes;
- errors;
- retries;
- validation;
- transitions;
- notifications.

---

# 20. Demo Simulation Testing

The simulation engine must be deterministic when a seed is supplied.

Example:

```text
Seed A
   ↓
Simulation
   ↓
Event Sequence A
```

Running again with the same seed should produce the same sequence where deterministic behavior is expected.

This makes simulations reproducible during testing and interviews.

---

# 21. Realtime Testing

Realtime behavior must be tested independently from visual rendering.

Tests should cover:

- connection;
- authentication;
- subscription;
- event reception;
- event validation;
- ordering;
- deduplication;
- disconnection;
- reconnection;
- stale events;
- unauthorized subscriptions.

---

# 22. Realtime UI Testing

The UI should react correctly to realtime events.

Example:

```text
Price Event
    ↓
State Update
    ↓
Affected Components
    ↓
Minimal Re-render
    ↓
Visible Update
```

Tests should verify that the correct data changes without requiring a full page reload.

---

# 23. Reconnection Testing

The application must recover from temporary realtime failures.

Test scenario:

```text
Connected
   ↓
Connection Lost
   ↓
Reconnecting
   ↓
Retry
   ↓
Connected
   ↓
Resynchronize State
```

The user should receive appropriate feedback.

---

# 24. Background Process Testing

Background processes should be tested through state transitions.

Example:

```text
Queued
 ↓
Running
 ↓
Progress
 ↓
Completed
```

Failure paths:

```text
Queued
 ↓
Running
 ↓
Failed
```

Timeout paths:

```text
Running
 ↓
Timeout
 ↓
Recovery / Failed
```

The exact states must follow the realtime and functional requirements.

---

# 25. Progress Testing

Progress values must be validated.

Expected behavior:

```text
0%
 ↓
25%
 ↓
50%
 ↓
75%
 ↓
100%
```

The system must prevent:

- negative progress;
- values above 100%;
- impossible state transitions;
- completion before required work is finished.

---

# 26. Notification Testing

Notifications should be tested for:

- creation;
- ordering;
- read/unread state;
- dismissal;
- duplicate prevention;
- realtime delivery;
- persistence where applicable.

---

# 27. Table Testing

TanStack Table implementations should test:

- sorting;
- filtering;
- pagination;
- column visibility;
- row selection;
- empty results;
- large datasets;
- reset filters.

The test should focus on user-visible outcomes rather than TanStack Table internals.

---

# 28. Chart Testing

Charts should be tested primarily through:

- data transformation;
- calculated values;
- loading state;
- empty state;
- error state;
- time-range selection;
- interaction behavior;
- realtime updates.

Pixel-perfect chart snapshots should not be the primary testing strategy.

---

# 29. Authentication Testing

Authentication tests must include:

### Success

- valid credentials;
- session creation;
- authenticated API request.

### Failure

- invalid credentials;
- malformed token;
- expired token;
- missing token.

### Lifecycle

- logout;
- session cleanup;
- cache cleanup;
- realtime disconnect.

---

# 30. Authorization Testing

Authorization tests must include:

- allowed role;
- denied role;
- resource ownership;
- cross-user access;
- administrative access;
- privilege escalation attempts.

Example:

```text
User A
  ↓
Request Portfolio B
  ↓
Ownership Check
  ↓
403
```

---

# 31. Security Testing

Security behavior from `09-security-spec.md` must have automated coverage.

At minimum:

- authentication bypass attempts;
- unauthorized resource access;
- invalid input;
- malformed tokens;
- permission escalation;
- unauthorized realtime subscription;
- sensitive error exposure;
- session isolation.

---

# 32. End-to-End Testing

Playwright will be used for critical user journeys.

E2E tests should run against a realistic application environment.

They should validate:

```text
Browser
 ↓
Frontend
 ↓
API
 ↓
Database / Mock Infrastructure
```

depending on the test environment.

---

# 33. Critical E2E Flows

The following flows should have E2E coverage:

### Authentication

```text
Login
 ↓
Dashboard
 ↓
Logout
```

### Portfolio

```text
Create Portfolio
 ↓
View Portfolio
 ↓
Update Portfolio
```

### Transaction

```text
Create Transaction
 ↓
Validation
 ↓
Confirmation
 ↓
Updated Position
```

### Analytics

```text
Open Analytics
 ↓
Select Portfolio
 ↓
Change Time Range
 ↓
Charts / Metrics Update
```

### Realtime

```text
Open Dashboard
 ↓
Realtime Connection
 ↓
Market Update
 ↓
UI Update
```

### Failure Recovery

```text
Request
 ↓
Failure
 ↓
Error UI
 ↓
Retry
 ↓
Success
```

---

# 34. Demo-Specific E2E Flows

Because the public demo is central to the portfolio, it requires additional E2E coverage.

At minimum:

- demo entry;
- demo user selection;
- simulated login;
- portfolio switching;
- market simulation;
- realtime price changes;
- alerts;
- background process execution;
- intentional failure scenario;
- retry/recovery;
- notifications;
- logout/reset.

---

# 35. E2E Test Data

E2E tests must use controlled test data.

Tests should not depend on:

- external financial APIs;
- real market data;
- production databases;
- real user accounts;
- external paid services.

The test environment must be reproducible.

---

# 36. Accessibility Testing

Accessibility is part of product quality.

Tests should cover:

- keyboard navigation;
- focus management;
- accessible names;
- form labels;
- dialog behavior;
- error announcements;
- semantic structure;
- reduced-motion behavior;
- contrast requirements.

Automated accessibility checks should complement manual keyboard testing.

---

# 37. Responsive Testing

Critical user flows should be tested across representative viewport sizes.

At minimum:

```text
Mobile
Tablet
Desktop
```

The goal is not to test every possible resolution.

Priority should be given to layout breakpoints where behavior changes.

---

# 38. Animation Testing

Animations should not be tested by exact timing unless timing itself is functional.

Instead, verify:

- element appears;
- element disappears;
- state transition occurs;
- interaction remains available;
- reduced-motion mode works.

Animation timing should remain tolerant to CI execution differences.

---

# 39. Performance Testing

Performance testing should focus on known risk areas.

Priority scenarios:

- large transaction tables;
- large historical chart datasets;
- frequent realtime updates;
- dashboard rendering;
- portfolio switching;
- repeated filtering;
- background simulation;
- reconnection.

---

# 40. Realtime Performance Tests

Realtime tests should measure whether frequent updates cause unacceptable rendering behavior.

The system should demonstrate:

- controlled update frequency;
- minimal unnecessary state changes;
- normalized realtime state;
- stable UI under sustained simulation.

The target of sub-100ms UI updates defined in the product specification should be validated under controlled test conditions.

---

# 41. Large Dataset Testing

The application should have representative generated datasets.

Examples:

```text
100 transactions
1,000 transactions
10,000 transactions
100,000 market points
```

The exact benchmark sizes may be adjusted based on implementation.

The goal is to identify where:

- rendering degrades;
- memory usage grows;
- filtering slows;
- chart interaction becomes unstable.

---

# 42. Simulation Load Testing

The simulation engine should support controlled rates.

Example:

```text
Low
Normal
High
Stress
```

This allows realtime behavior to be evaluated without requiring external services.

---

# 43. Regression Testing

Every significant bug fixed in the project should result in a regression test when practical.

The test should reproduce the original failure and verify the fix.

Examples:

```text
Bug
 ↓
Regression Test
 ↓
Fix
 ↓
Permanent Protection
```

---

# 44. Test Naming

Tests should describe behavior.

Preferred:

```text
should reject a transaction when available balance is insufficient
```

Avoid implementation-oriented names such as:

```text
should call validateBalance()
```

unless the function itself is the intended unit under test.

---

# 45. Test Independence

Tests must be independent.

A test must not rely on another test having:

- created a portfolio;
- authenticated a user;
- modified shared state;
- populated a database;
- established a WebSocket connection.

Each test should establish its own required state.

---

# 46. Test Isolation

Tests should use isolated state.

Possible mechanisms:

- reset mock stores;
- database transactions;
- test database cleanup;
- deterministic seeds;
- isolated browser contexts.

The chosen mechanism depends on the test layer.

---

# 47. Flaky Test Policy

Flaky tests must not be ignored.

If a test fails intermittently:

1. identify the source;
2. reproduce the failure;
3. fix the underlying synchronization or isolation issue;
4. avoid arbitrary retries as a permanent solution.

Retries may be used temporarily for diagnostics but should not hide real instability.

---

# 48. Mocking Policy

Mocks should be used at architectural boundaries.

Good candidates:

- external APIs;
- realtime transports;
- repositories;
- browser APIs;
- time;
- randomness.

Avoid mocking the unit under test itself.

The goal is to test behavior, not mock interactions.

---

# 49. Time Control

Time-dependent functionality should use controllable clocks where practical.

This is important for:

- token expiration;
- alerts;
- simulations;
- time ranges;
- background jobs;
- retries;
- timeouts.

Tests must not rely on arbitrary real-world delays.

---

# 50. Randomness Control

Random simulation behavior must support deterministic seeds.

This allows:

- reproducible bugs;
- stable tests;
- predictable demo scenarios;
- interview demonstrations.

Randomness should be isolated behind an explicit abstraction.

---

# 51. Network Failure Testing

The demo and automated tests should simulate:

- offline state;
- latency;
- timeout;
- server error;
- connection reset;
- malformed response.

The application must provide recovery behavior where appropriate.

---

# 52. API Contract Testing

API request and response contracts should be verified against the OpenAPI specification.

Contract tests should detect:

- renamed fields;
- missing fields;
- incompatible types;
- incorrect status codes;
- malformed error responses.

This reduces frontend/backend integration regressions.

---

# 53. CI Test Pipeline

The CI pipeline should follow:

```text
Install
  ↓
Typecheck
  ↓
Lint
  ↓
Unit Tests
  ↓
Component Tests
  ↓
Integration Tests
  ↓
Build
  ↓
E2E Tests
  ↓
Accessibility Checks
```

Performance tests may run separately when they are too expensive for every pull request.

---

# 54. Pull Request Quality Gate

A pull request should not be considered complete when:

- type checking fails;
- lint fails;
- required tests fail;
- build fails;
- critical E2E flows fail.

Tests should be treated as part of implementation rather than a final manual step.

---

# 55. Coverage Strategy

Coverage should be used as a diagnostic metric rather than a target to game.

High coverage is expected for:

- domain rules;
- calculations;
- authorization;
- validation;
- critical application services.

Lower coverage may be acceptable for:

- simple UI composition;
- generated code;
- trivial configuration;
- purely visual details.

Critical behavior matters more than a global percentage.

---

# 56. Test Environments

The project should distinguish:

```text
Development
Test
Demo
Production-like
```

### Development

Used for daily implementation.

### Test

Controlled environment for automated tests.

### Demo

Public-facing mock-powered experience.

### Production-like

Local or optional deployment environment using the complete backend architecture.

---

# 57. Demo vs Production Testing

The same application behavior should be exercised against both:

```text
Mock Infrastructure
```

and:

```text
Real Infrastructure
```

where practical.

The purpose is to demonstrate that infrastructure is replaceable without rewriting product behavior.

---

# 58. Testability Requirements

The architecture must make important behavior easy to test.

Required properties:

- dependency injection at infrastructure boundaries;
- deterministic simulation;
- isolated domain logic;
- explicit state transitions;
- typed contracts;
- replaceable repositories;
- controllable clocks;
- controllable randomness;
- transport abstractions.

---

# 59. Required Test Matrix

| Area | Unit | Component | Integration | E2E |
|---|---:|---:|---:|---:|
| Domain calculations | Required | — | — | — |
| Validation | Required | Required | Required | — |
| Forms | — | Required | Required | Required |
| Authentication | Required | Required | Required | Required |
| Authorization | Required | — | Required | Required |
| Portfolios | Required | Required | Required | Required |
| Transactions | Required | Required | Required | Required |
| Analytics | Required | Required | Required | Required |
| Tables | — | Required | — | Required |
| Charts | Required | Required | — | Required |
| Realtime | Required | Required | Required | Required |
| Background jobs | Required | Required | Required | Required |
| Notifications | Required | Required | Required | Required |
| Simulation | Required | Required | Required | Required |
| Security | Required | — | Required | Required |
| Accessibility | — | Required | — | Required |
| Performance | Required | Required | Required | Selected |

---

# 60. Minimum Automated Test Suite

Before the project is considered portfolio-ready, the following must exist:

### Unit

- core domain calculations;
- transaction rules;
- validation;
- permissions;
- simulation;
- realtime event processing.

### Component

- major forms;
- major tables;
- dashboard states;
- dialogs;
- notifications;
- realtime indicators.

### Integration

- authentication;
- authorization;
- portfolio API;
- transaction API;
- analytics API;
- realtime events;
- repository behavior.

### E2E

- login/demo entry;
- portfolio workflow;
- transaction workflow;
- analytics workflow;
- realtime workflow;
- error/retry workflow;
- logout/reset.

---

# 61. Definition of Done — Feature

A feature is considered complete when:

- implementation is complete;
- TypeScript passes;
- lint passes;
- formatting passes;
- relevant unit tests exist;
- relevant component tests exist;
- integration tests exist when boundaries are involved;
- E2E coverage exists when the feature is part of a critical user journey;
- loading state is handled;
- empty state is handled;
- error state is handled;
- accessibility has been considered;
- responsive behavior has been verified;
- demo mode supports the feature;
- documentation is updated when architectural behavior changes.

---

# 62. Definition of Done — Demo

The public demo is considered complete when a visitor can experience the platform without backend dependencies.

The demo must support:

```text
Entry
 ↓
Authentication Simulation
 ↓
Dashboard
 ↓
Portfolio Management
 ↓
Transactions
 ↓
Analytics
 ↓
Realtime Simulation
 ↓
Alerts / Notifications
 ↓
Background Processes
 ↓
Errors
 ↓
Recovery
 ↓
Logout / Reset
```

No screen should exist only as a visual mock.

---

# 63. Failure Scenarios Required in Demo

The demo should intentionally support selected reproducible failures.

Examples:

```text
Network Timeout
API 500
Unauthorized
Forbidden
Validation Error
Realtime Disconnect
Realtime Reconnect
Background Job Failure
Background Job Timeout
Empty Dataset
Simulation Pause
```

These scenarios should be controllable without making the normal user flow frustrating.

---

# 64. Interview Demonstration Mode

The application should provide deterministic scenarios suitable for technical interviews.

Examples:

### Realtime Scenario

```text
Start Simulation
 ↓
Price Updates
 ↓
Portfolio Value Changes
 ↓
Alert Triggered
```

### Failure Scenario

```text
Start Operation
 ↓
Simulated Failure
 ↓
Error State
 ↓
Retry
 ↓
Successful Recovery
```

### Architecture Scenario

```text
Switch:
Mock Repository
        ↓
Real API
```

where technically feasible.

The objective is to make architectural decisions observable rather than merely documented.

---

# 65. Testing Acceptance Criteria

Testing is considered complete when:

- core business rules have unit tests;
- critical components have interaction tests;
- API boundaries have integration tests;
- authentication and authorization are tested;
- realtime behavior is tested;
- simulation is deterministic;
- critical E2E flows pass;
- demo flows are covered;
- failure and recovery states are covered;
- accessibility has automated and manual verification;
- representative performance scenarios are validated;
- CI executes the required quality gates;
- tests are reproducible and isolated.

---

# 66. Testing Philosophy Summary

The testing strategy follows one principle:

> **Test the behavior that makes the product trustworthy, not merely the code that makes it executable.**

The public demo and the production-oriented implementation must share the same application behavior and contracts wherever possible.

Mock infrastructure changes **where data comes from**, not **how the product behaves**.
