# SDD 15 — Implementation Plan

**Project:** Trading Analytics Platform  
**Document:** Implementation Plan  
**Version:** 1.0  
**Status:** Final Implementation Roadmap  
**Previous document:** `14-deployment-spec.md`

---

## 1. Purpose

This document translates the complete Software Design Document set into an executable implementation roadmap.

The objective is to build the Trading Analytics Platform incrementally while preserving product coherence, architectural boundaries, security, testability, realtime behavior, Demo Mode, observability, deployment reproducibility, and technical interview readiness.

Implementation should proceed in vertical slices where practical rather than building the entire frontend, backend, and infrastructure independently and integrating them at the end.

---

## 2. Implementation Philosophy

> **Build the smallest complete system that proves each architectural decision before increasing scope.**

The project should optimize for demonstrating:

```text
Product Thinking
      ↓
UX/UI
      ↓
Architecture
      ↓
Implementation
      ↓
Testing
      ↓
Observability
      ↓
Deployment
```

Do not add technologies merely to increase the apparent size of the stack.

---

## 3. Implementation Rules

1. Do not optimize based on assumptions; measure first.
2. Do not invent performance, business, or user metrics.
3. Keep domain rules outside presentation code.
4. Use explicit typed contracts at important boundaries.
5. Keep infrastructure replaceable through adapters.
6. Treat Demo Mode as part of the architecture.
7. Design failure states alongside happy paths.
8. Prefer simple infrastructure until complexity is justified.
9. Update the SDDs when implementation intentionally diverges from them.
10. Keep the repository reproducible from a clean environment.

---

## 4. Phase Overview

```text
Phase 0  → Repository foundation
Phase 1  → Product/domain foundation
Phase 2  → Database and infrastructure
Phase 3  → Backend/API foundation
Phase 4  → Authentication/RBAC
Phase 5  → Frontend foundation
Phase 6  → Core portfolio workflows
Phase 7  → Transactions and positions
Phase 8  → Tables, filters and analytics
Phase 9  → Realtime
Phase 10 → Background operations
Phase 11 → Demo Mode
Phase 12 → Testing hardening
Phase 13 → Observability
Phase 14 → Deployment
Phase 15 → UX/performance/accessibility refinement
Phase 16 → Portfolio case study and interview readiness
```

After foundational contracts are stable, some phases can proceed in parallel.

---

## 5. Phase 0 — Repository Foundation

### Objective

Create the repository structure and development conventions.

### Tasks

- initialize Git repository
- define repository structure
- initialize the package manager
- commit the lockfile
- configure TypeScript
- configure ESLint
- configure Prettier
- configure editor conventions
- configure `.gitignore`
- create `.env.example`
- document basic commands
- establish a coherent commit workflow

### Acceptance Criteria

- a clean clone can install dependencies
- TypeScript works
- linting works
- formatting works
- no secrets exist in Git
- basic development instructions are documented

---

## 6. Phase 1 — Product and Domain Foundation

### Objective

Translate the product specification into explicit domain concepts.

Initial concepts may include:

```text
User
Role
Portfolio
PortfolioMember
Instrument
Position
Transaction
PriceSnapshot
AnalyticsSnapshot
BackgroundJob
Notification
```

The final model must follow the product and functional specifications.

### Tasks

- define domain entities
- define value objects where useful
- define enums
- define domain invariants
- define ownership rules
- define transaction states
- define portfolio calculations
- identify derived data

### Acceptance Criteria

Core business rules can be tested without React, Express, or PostgreSQL.

---

## 7. Phase 2 — Database and Infrastructure

### Objective

Create persistent infrastructure without coupling domain logic directly to PostgreSQL.

### Tasks

- configure PostgreSQL
- configure Docker
- configure Docker Compose
- select migration tooling
- create initial schema
- implement migrations
- create seed workflow
- create local reset workflow
- configure database connection
- define repository interfaces
- implement PostgreSQL repositories

### Acceptance Criteria

A clean environment can:

```text
start database
→ migrate
→ seed
→ run application
```

---

## 8. Phase 3 — Backend/API Foundation

### Objective

Build the backend application structure.

Recommended boundary:

```text
API
 ↓
Application
 ↓
Domain
 ↓
Infrastructure
```

### Tasks

- initialize Express
- configure middleware
- implement request validation
- implement consistent error handling
- implement request IDs
- establish API response conventions
- establish authentication middleware
- establish authorization middleware
- implement application services
- integrate repositories
- implement health endpoints
- implement safe structured logging

### Acceptance Criteria

The API:

- starts cleanly
- validates configuration
- connects to PostgreSQL
- exposes health/readiness information
- returns consistent errors
- produces structured diagnostics
- supports request correlation

---

## 9. Phase 4 — Authentication and RBAC

### Objective

Implement secure access control.

### Tasks

- user model
- password handling
- login
- token generation
- token validation
- authentication middleware
- role model
- permission checks
- protected routes
- authentication tests
- authorization tests

### Principles

```text
Frontend authorization check
→ UX convenience

Backend authorization check
→ Security boundary
```

### Acceptance Criteria

- unauthenticated requests are rejected
- invalid tokens are rejected
- expired tokens are rejected
- protected resources enforce authorization
- frontend visibility does not replace backend authorization

---

## 10. Phase 5 — Frontend Foundation

### Objective

Build the application shell and frontend architecture.

### Tasks

- initialize React + Vite
- configure TypeScript
- configure Tailwind CSS
- configure shadcn/ui
- configure routing
- configure TanStack Query
- configure Zustand where justified
- configure React Hook Form
- configure Zod
- establish feature structure
- establish shared UI structure
- establish design tokens
- implement app shell

Suggested structure:

```text
src/
├── app/
├── features/
├── components/
├── layouts/
├── lib/
├── hooks/
├── services/
├── stores/
├── types/
└── styles/
```

The final structure may evolve during implementation.

---

## 11. Phase 6 — Core Portfolio Workflow

### Objective

Deliver the first complete vertical product slice.

Recommended flow:

```text
Login
 ↓
Dashboard
 ↓
Portfolio
 ↓
Portfolio details
 ↓
Positions
 ↓
Transactions
```

### Tasks

- dashboard shell
- portfolio listing
- portfolio detail
- authentication state
- API integration
- navigation
- loading states
- empty states
- error states
- responsive behavior

### Acceptance Criteria

A user can complete the primary portfolio workflow against the real backend.

---

## 12. Phase 7 — Transactions and Positions

### Objective

Implement the core trading-domain workflows.

### Tasks

- create transaction
- edit transaction where permitted
- delete/cancel where permitted
- transaction validation
- position calculation
- position updates
- transaction history
- duplicate prevention
- conflict handling
- derived values
- user feedback

### Important Principle

Transaction state must have a clear authoritative source.

Business rules should not be duplicated independently across:

```text
React
API controller
repository
```

Domain/application services remain responsible for business behavior.

---

## 13. Phase 8 — Tables, Filters and Analytics

### Objective

Implement complex data exploration.

### TanStack Table

Use TanStack Table for:

- transaction tables
- position tables
- portfolio datasets
- analytics datasets where appropriate

Features:

- sorting
- filtering
- pagination
- column visibility
- responsive behavior
- loading state
- empty state
- error state

### Analytics

Implement only metrics defined by the product specification.

Possible categories:

```text
portfolio value
P&L
returns
win/loss statistics
exposure
drawdown
transaction statistics
```

Exact formulas must be explicitly defined and tested.

---

## 14. Phase 9 — Realtime

### Objective

Introduce realtime behavior without creating a parallel application architecture.

### Tasks

- WebSocket server
- connection lifecycle
- authentication
- subscriptions
- typed event contracts
- event validation
- client connection manager
- reconnection
- resynchronization
- market simulation
- UI update strategy
- cleanup

### Recommended Order

```text
WebSocket connection
 ↓
authentication
 ↓
subscription
 ↓
single event
 ↓
multiple events
 ↓
reconnect
 ↓
resync
 ↓
performance validation
```

Do not build complex market simulation before the transport itself is stable.

---

## 15. Phase 10 — Background Operations

### Objective

Implement long-running operations.

Possible examples:

- analytics recalculation
- data import
- report generation
- file generation
- expensive portfolio processing

### Required States

```text
queued
running
completed
failed
cancelled
timeout
```

### UI Requirements

The frontend should expose:

- progress
- current state
- errors
- cancellation where supported
- completion feedback
- resulting artifact/data

---

## 16. Phase 11 — Demo Mode

### Objective

Create a public demo that behaves like a product rather than a static prototype.

Follow `12-demo-mode-spec.md`.

### Tasks

- runtime mode selection
- mock repositories
- mock services
- deterministic seed
- local persistence
- simulated latency
- failure injection
- simulated realtime
- market scenarios
- background job simulation
- demo authentication
- reset
- diagnostics

### Acceptance Criteria

The public demo can operate without:

- paid market APIs
- production database
- production WebSocket infrastructure
- private backend services

The same product/application behavior should remain conceptually shared with the real implementation.

---

## 17. Phase 12 — Testing Hardening

### Objective

Increase confidence across the system.

Follow `10-testing-strategy.md`.

### Test Layers

```text
Unit
 ↓
Integration
 ↓
Component
 ↓
E2E
```

### Priority Areas

#### Domain

- calculations
- invariants
- transaction rules

#### API

- validation
- authentication
- authorization
- errors

#### Frontend

- forms
- tables
- filters
- loading/error states

#### Realtime

- connect
- disconnect
- reconnect
- event processing

#### Demo

- simulation
- failures
- reset
- persistence

#### E2E

- login
- portfolio workflow
- transaction workflow
- analytics
- realtime
- recovery

---

## 18. Phase 13 — Observability

### Objective

Make runtime behavior diagnosable.

Follow `13-observability-spec.md`.

### Tasks

- structured logging
- request IDs
- error categorization
- health checks
- readiness
- metrics
- realtime diagnostics
- background-job diagnostics
- performance measurements
- local debugging tools

### Acceptance Criteria

A developer can diagnose:

- API failures
- database failures
- authentication failures
- realtime disconnects
- background operation failures

without requiring a paid external monitoring service.

---

## 19. Phase 14 — Deployment

### Objective

Make the system reproducibly deployable.

Follow `14-deployment-spec.md`.

### Tasks

- production frontend build
- production backend build
- production Docker image
- environment configuration
- migration deployment
- health checks
- smoke tests
- HTTPS/WSS configuration
- deployment documentation
- rollback documentation

### Acceptance Criteria

A production-like deployment can be started and verified through documented steps.

---

## 20. Phase 15 — UX, Accessibility and Performance Refinement

### Objective

Polish the product after the functional architecture is stable.

### UX

Review:

- hierarchy
- spacing
- typography
- visual consistency
- feedback
- empty states
- error states
- motion
- responsive behavior

### Accessibility

Validate:

- keyboard navigation
- focus management
- labels
- semantic structure
- screen reader support
- reduced motion
- contrast

### Performance

Measure before optimizing.

Potential areas:

- unnecessary React renders
- query caching
- table rendering
- chart rendering
- bundle size
- realtime update frequency
- expensive calculations
- network payloads

---

## 21. Phase 16 — Portfolio Case Study

### Objective

Transform the implemented system into evidence of engineering capability.

The final case study must be based on actual implementation evidence.

Recommended structure:

```text
Problem
 ↓
Context
 ↓
Goals
 ↓
Constraints
 ↓
Architecture
 ↓
Key decisions
 ↓
Implementation
 ↓
Challenges
 ↓
Testing
 ↓
Performance
 ↓
Security
 ↓
Demo
 ↓
Outcomes
 ↓
Lessons
 ↓
Future evolution
```

Do not publish metrics or outcomes until they have actually been measured.

---

## 22. Dependency Graph

```text
Repository
    ↓
Domain
    ↓
Database
    ↓
Backend
    ↓
Auth
    ↓
Frontend
    ↓
Core workflows
    ↓
Transactions
    ↓
Analytics
    ↓
Realtime
    ↓
Background operations
    ↓
Demo
    ↓
Testing
    ↓
Observability
    ↓
Deployment
    ↓
Case Study
```

Once contracts are stable, some implementation work may proceed concurrently.

---

## 23. Recommended Vertical Slices

### Slice 1 — Authentication

```text
User
→ Login
→ Authenticated shell
```

### Slice 2 — Portfolio

```text
Portfolio
→ API
→ Database
→ UI
```

### Slice 3 — Transaction

```text
Transaction
→ Validation
→ Persistence
→ Position update
→ UI
```

### Slice 4 — Analytics

```text
Analytics
→ Calculation
→ API
→ Table/chart
```

### Slice 5 — Realtime

```text
Event
→ Server
→ Client
→ UI
```

### Slice 6 — Background Operation

```text
Job
→ Progress
→ Completion
→ UI
```

### Slice 7 — Demo

```text
Same flow
→ Mock infrastructure
```

---

## 24. Contract-First Boundaries

Before implementing a major feature, define:

```text
Domain behavior
Application use case
API contract
Persistence contract
Frontend data contract
```

Then implement each side.

This reduces accidental coupling.

---

## 25. API Implementation Order

Recommended:

```text
Health
 ↓
Auth
 ↓
Users / session
 ↓
Portfolios
 ↓
Positions
 ↓
Transactions
 ↓
Analytics
 ↓
Background jobs
 ↓
Notifications
```

Realtime capabilities should be implemented alongside the corresponding domain capabilities.

---

## 26. Database Implementation Order

Recommended:

```text
Users / Roles
 ↓
Portfolios
 ↓
Instruments
 ↓
Transactions
 ↓
Positions
 ↓
Price data
 ↓
Analytics support data
 ↓
Jobs / Notifications
```

Foreign keys and constraints should reflect domain ownership.

---

## 27. Frontend Implementation Order

Recommended:

```text
App shell
 ↓
Authentication
 ↓
Dashboard
 ↓
Portfolio
 ↓
Positions
 ↓
Transactions
 ↓
Analytics
 ↓
Realtime
 ↓
Background operations
 ↓
Demo controls
```

Shared components should be extracted when repetition is demonstrated, not merely anticipated.

---

## 28. State Management Strategy

Use the smallest appropriate state scope.

### Server state

TanStack Query:

- portfolios
- positions
- transactions
- analytics
- API responses

### Client/global state

Zustand only when state genuinely spans features:

- UI preferences
- demo controls
- realtime connection state where justified

### Local state

React state for:

- form state
- dialogs
- temporary UI interactions
- local controls

Avoid putting server state into Zustand without a clear reason.

---

## 29. Form Strategy

Use:

```text
React Hook Form
+
Zod
```

for structured forms.

Validation should exist at multiple boundaries:

```text
UI validation
      ↓
API validation
      ↓
Domain invariants
```

Frontend validation improves UX.

Backend/domain validation protects correctness.

---

## 30. Error Handling Strategy

Errors should be designed by category:

```text
Validation
Authentication
Authorization
Not Found
Conflict
Rate Limit
Dependency Failure
Internal Error
Network Failure
Realtime Failure
Background Job Failure
```

Each category should have appropriate:

- backend representation
- frontend behavior
- logging behavior
- user-facing message

---

## 31. Realtime Implementation Strategy

Realtime should not become a second application architecture.

Use:

```text
Domain event
 ↓
Application event
 ↓
Realtime adapter
 ↓
WebSocket
 ↓
Frontend event handler
```

The UI should react to meaningful state changes rather than infrastructure details whenever possible.

---

## 32. Performance Measurement Strategy

Performance work should follow:

```text
Hypothesis
 ↓
Measurement
 ↓
Diagnosis
 ↓
Change
 ↓
Measurement
 ↓
Comparison
```

Do not add claims such as:

- “sub-100ms”
- “95+ Lighthouse”
- “40% faster”

unless measured and documented.

---

## 33. Security Validation Strategy

Before completion, review:

```text
Authentication
Authorization
Input validation
CORS
Secrets
Rate limiting
Resource limits
Error exposure
File handling
Dependency security
```

Security is an architectural property, not only a final checklist.

---

## 34. Accessibility Validation Strategy

Every primary flow should be tested for:

- keyboard navigation
- focus management
- labels
- semantic controls
- error association
- modal behavior
- table interaction
- reduced motion

Automated accessibility testing should complement manual inspection.

---

## 35. Demo Validation Strategy

Demo Mode must be tested independently from real infrastructure.

Required scenarios:

```text
normal flow
slow network
API failure
realtime disconnect
reconnect
background job failure
background job timeout
empty state
reset
persistence
```

The demo must remain coherent after each scenario.

---

## 36. Observability Validation Strategy

Verify that developers can identify:

### Request problem

```text
request ID
→ structured log
→ error
```

### Database problem

```text
health/readiness
→ dependency error
→ diagnostic log
```

### Realtime problem

```text
connection ID
→ lifecycle event
→ reconnect
```

### Background problem

```text
job ID
→ progress
→ failure/timeout
```

---

## 37. Deployment Validation Strategy

Test from a clean environment:

```text
checkout
 ↓
install
 ↓
build
 ↓
database
 ↓
migrate
 ↓
seed
 ↓
start
 ↓
health
 ↓
smoke
```

The system should not depend on hidden developer-machine state.

---

## 38. Git Workflow

Use small, coherent commits.

Recommended prefixes:

```text
feat:
fix:
refactor:
test:
docs:
chore:
```

Examples:

```text
feat: add portfolio repository
feat: implement transaction creation
test: cover transaction invariants
fix: handle websocket reconnect state
docs: document local deployment
```

Avoid enormous commits containing unrelated systems.

---

## 39. Feature Completion

A feature is not complete when its UI exists.

When applicable, completion should include:

```text
Domain
API
Persistence
UI
Validation
Error states
Loading states
Authorization
Tests
Observability
Documentation
```

Omissions must be intentional.

---

## 40. Technical Completion

The project is technically complete when:

- core domain is implemented
- backend is functional
- frontend is functional
- authentication works
- RBAC works
- PostgreSQL persists data
- REST API works
- WebSockets work
- background operations work
- Demo Mode works
- tests cover primary flows
- observability is available
- deployment is reproducible
- documentation is sufficient

---

## 41. Product Completion

The product is product-complete when a user can:

```text
sign in
 ↓
view dashboard
 ↓
manage portfolio
 ↓
inspect positions
 ↓
record transactions
 ↓
review analytics
 ↓
experience realtime updates
 ↓
receive operation feedback
```

with coherent loading, empty, success, and failure states.

---

## 42. Portfolio Completion

The portfolio project is complete when a reviewer can:

1. understand the problem quickly
2. enter the functional demo
3. understand the product
4. inspect the architecture
5. inspect the repository
6. understand key engineering decisions
7. verify meaningful implementation
8. understand tradeoffs
9. see testing and quality practices
10. understand how the system could evolve

---

## 43. Technical Interview Readiness

Prepare concise explanations for:

### Architecture

Why feature/domain-oriented architecture?

### Database

Why PostgreSQL?

### API

Why REST and where are contracts enforced?

### State

Why TanStack Query + Zustand?

### Tables

Why TanStack Table?

### Realtime

Why WebSockets?

### Demo

Why mock adapters instead of a static prototype?

### Authentication

Why JWT + RBAC?

### Deployment

Why Docker and a simple deployment topology?

### Testing

Why multiple test layers?

### Scalability

What changes when the system grows?

---

## 44. Architecture Decision Review

Before final case-study publication, review major decisions using:

```text
Problem
Decision
Alternatives
Reason
Tradeoffs
Evidence
Future evolution
```

Candidate decisions include:

- PostgreSQL
- REST
- WebSockets
- Zustand
- TanStack Query
- TanStack Table
- Docker
- mock adapters
- JWT
- RBAC

---

## 45. Avoiding Overengineering

Do not introduce technologies only because they appear in modern stacks.

Avoid premature introduction of:

- Kubernetes
- microservices
- Kafka
- Redis
- GraphQL
- event sourcing
- CQRS
- service mesh
- complex cloud orchestration

unless implementation discovers a real requirement.

The project should demonstrate engineering judgment by knowing what **not** to build.

---

## 46. Scalability Demonstration

Scalability should be demonstrated through boundaries.

Examples:

```text
Repository interface
→ database replacement

Realtime adapter
→ shared broker later

Background operation abstraction
→ dedicated worker later

Infrastructure adapter
→ external provider later
```

This is stronger than claiming that the initial system is infinitely scalable.

---

## 47. Performance Demonstration

Performance should be demonstrated through:

- measurement
- profiling
- efficient data fetching
- pagination
- caching where justified
- bounded realtime history
- controlled renders
- appropriate payload sizes

Optimize observed bottlenecks, not hypothetical ones.

---

## 48. Security Demonstration

Security should be visible through implementation evidence:

```text
JWT
RBAC
validation
CORS
rate limits
resource limits
secret management
safe errors
```

Do not present security features as complete until they have actually been implemented and validated.

---

## 49. Developer Experience

The repository should aim for:

```text
clone
 ↓
install
 ↓
configure
 ↓
docker compose
 ↓
migrate
 ↓
seed
 ↓
run
```

Documentation should cover:

- prerequisites
- commands
- environment variables
- database reset
- tests
- build
- deployment
- troubleshooting

---

## 50. Documentation Strategy

Maintain documentation during implementation.

Recommended categories:

```text
README
Architecture
API
Development
Testing
Demo
Deployment
Troubleshooting
Case Study
```

Actual implementation details override assumptions in the SDDs when implementation reveals a better solution.

Meaningful deviations should be documented.

---

## 51. SDD Change Management

The SDDs describe the target architecture, but they are not immutable.

If implementation requires a meaningful deviation:

```text
Identify discrepancy
 ↓
Evaluate impact
 ↓
Update relevant SDD
 ↓
Document decision
 ↓
Implement
```

Do not silently diverge from the documented architecture.

---

## 52. Milestone 1 — Foundation

Complete:

- repository
- TypeScript
- tooling
- Docker
- PostgreSQL
- migrations
- domain foundation

### Exit Criteria

```text
clean setup works
database works
domain tests work
```

---

## 53. Milestone 2 — Backend Core

Complete:

- Express
- configuration
- repositories
- API foundation
- health
- logging
- authentication
- RBAC

### Exit Criteria

```text
authenticated API
+
database persistence
+
observable runtime
```

---

## 54. Milestone 3 — Functional Product

Complete:

- frontend shell
- authentication UI
- dashboard
- portfolios
- positions
- transactions
- analytics

### Exit Criteria

```text
primary user workflow works end-to-end
```

---

## 55. Milestone 4 — Realtime and Operations

Complete:

- WebSockets
- reconnect
- realtime updates
- background jobs
- progress UI
- notifications

### Exit Criteria

```text
realtime + long-running operations
work reliably with failure states
```

---

## 56. Milestone 5 — Demo

Complete:

- mock adapters
- deterministic data
- persistence
- simulated latency
- failure injection
- realtime simulation
- reset

### Exit Criteria

```text
public demo works without production infrastructure
```

---

## 57. Milestone 6 — Quality

Complete:

- unit tests
- integration tests
- component tests
- E2E
- accessibility
- security review
- performance measurement

### Exit Criteria

```text
primary product and recovery flows are tested
```

---

## 58. Milestone 7 — Deployment

Complete:

- production builds
- Docker
- environment configuration
- deployment
- health
- smoke tests
- deployment documentation

### Exit Criteria

```text
clean production-like deployment is reproducible
```

---

## 59. Milestone 8 — Portfolio

Complete:

- project page
- architecture visualization
- technical decisions
- implementation highlights
- demo link
- repository link
- screenshots
- measured outcomes
- lessons learned

### Exit Criteria

```text
project communicates engineering ability
without unsupported claims
```

---

## 60. Final Repository Validation

Run from a clean environment:

```text
Install
Lint
Type check
Unit tests
Integration tests
Build
E2E
Docker build
Docker startup
Migrations
Seed
Health checks
Smoke tests
```

Every failure should be resolved or explicitly documented.

---

## 61. Final Quality Gate

### Product

- Does the product solve the defined problem?
- Are primary flows coherent?

### UX

- Is the interface understandable?
- Are failures communicated well?

### Architecture

- Are responsibilities separated?
- Can infrastructure be replaced?

### Backend

- Are domain rules centralized?
- Are APIs validated?

### Frontend

- Is server state separated from UI state?
- Are components maintainable?

### Realtime

- Does reconnect work?
- Are updates efficient?

### Security

- Are authorization boundaries enforced?

### Testing

- Do tests verify behavior?

### Observability

- Can failures be diagnosed?

### Deployment

- Can another developer reproduce the environment?

### Demo

- Does the demo prove the architecture?

### Portfolio

- Are all claims supported by evidence?

---

## 62. What Must Not Be Done

The following are explicitly prohibited unless later justified:

- fabricate performance metrics
- fabricate users or business outcomes
- claim production scale that does not exist
- present mock infrastructure as real infrastructure
- expose private credentials
- rely on paid APIs for the core demo
- build static-only demo flows
- duplicate domain rules across frontend/backend
- add technologies only for resume keywords
- hide architectural tradeoffs
- postpone all testing until the end
- postpone all documentation until the end

---

## 63. Final Implementation Sequence

The recommended execution sequence is:

```text
01. Repository
02. Tooling
03. Docker
04. PostgreSQL
05. Migrations
06. Domain model
07. Repository layer
08. Express/API foundation
09. Observability foundation
10. Authentication
11. RBAC
12. Frontend shell
13. Auth UI
14. Dashboard
15. Portfolio
16. Positions
17. Transactions
18. Analytics
19. Tables/filters
20. Realtime
21. Background operations
22. Notifications
23. Demo adapters
24. Demo simulations
25. Unit/integration/component tests
26. E2E tests
27. Accessibility validation
28. Security review
29. Performance measurement
30. Production build
31. Deployment
32. Smoke tests
33. Documentation
34. Case study
35. Interview preparation
```

This sequence should be adjusted when real implementation dependencies reveal a better order.

---

## 64. Final Architecture Validation

At the end of implementation, verify that the conceptual architecture remains:

```text
                    PRESENTATION
                         │
                         ▼
                      FEATURES
                         │
                         ▼
                    APPLICATION
                         │
                         ▼
                       DOMAIN
                         │
                         ▼
                   INFRASTRUCTURE
                         │
             ┌───────────┼───────────┐
             │           │           │
          PostgreSQL   WebSocket   External APIs
```

For Demo Mode:

```text
                    PRESENTATION
                         │
                         ▼
                      FEATURES
                         │
                         ▼
                    APPLICATION
                         │
                         ▼
                       DOMAIN
                         │
                         ▼
                  MOCK INFRASTRUCTURE
                         │
             ┌───────────┼───────────┐
             │           │           │
          Mock DB     Mock API    Simulated WS
```

The product/application layer remains shared.

---

## 65. Final Project Principle

The complete project should communicate:

> **The system is designed so that complexity can evolve without forcing the product to become fragile.**

The portfolio should demonstrate:

- deliberate boundaries
- explicit tradeoffs
- coherent domain modeling
- maintainable frontend architecture
- reliable backend architecture
- secure access control
- realtime capability
- realistic failure handling
- testability
- observability
- deployment awareness
- infrastructure substitution
- thoughtful UX

---

## 66. Final Definition of Done

### Product

- [ ] primary workflows are functional
- [ ] portfolio management works
- [ ] positions are represented correctly
- [ ] transactions work
- [ ] analytics are coherent
- [ ] realtime behavior is meaningful

### Architecture

- [ ] application layers are separated
- [ ] domain rules are isolated
- [ ] infrastructure uses adapters
- [ ] Demo Mode uses infrastructure substitution
- [ ] major boundaries are documented

### Frontend

- [ ] React + TypeScript application works
- [ ] routing works
- [ ] TanStack Query is used appropriately
- [ ] Zustand is used only where justified
- [ ] TanStack Table supports complex data
- [ ] forms use appropriate validation
- [ ] loading/error/empty states exist
- [ ] responsive behavior is validated

### Backend

- [ ] Node.js + TypeScript API works
- [ ] REST contracts are implemented
- [ ] PostgreSQL persistence works
- [ ] authentication works
- [ ] RBAC works
- [ ] validation works
- [ ] error handling works
- [ ] health checks work

### Realtime

- [ ] WebSocket connection works
- [ ] events are typed
- [ ] reconnect works
- [ ] resynchronization is handled
- [ ] simulated realtime works in Demo Mode

### Operations

- [ ] background jobs work
- [ ] progress is visible
- [ ] failures are handled
- [ ] cancellation/timeout behavior is implemented where applicable

### Testing

- [ ] unit tests exist
- [ ] integration tests exist
- [ ] component tests exist where valuable
- [ ] E2E tests cover critical flows
- [ ] Demo Mode scenarios are tested

### Security

- [ ] secrets are protected
- [ ] authorization is server-side
- [ ] inputs are validated
- [ ] CORS is configured
- [ ] resource limits exist
- [ ] sensitive errors are not exposed

### Observability

- [ ] structured logs exist
- [ ] request IDs exist
- [ ] health/readiness exist
- [ ] errors are diagnosable
- [ ] realtime lifecycle can be inspected
- [ ] background operations can be diagnosed

### Deployment

- [ ] Docker setup works
- [ ] production builds work
- [ ] migrations work
- [ ] environment configuration is documented
- [ ] deployment is reproducible
- [ ] smoke tests work

### Demo

- [ ] no paid infrastructure is required
- [ ] demo is functional
- [ ] realistic loading exists
- [ ] failures can be simulated
- [ ] realtime simulation works
- [ ] demo can reset safely

### Portfolio

- [ ] case study reflects actual implementation
- [ ] architecture is visualized
- [ ] tradeoffs are documented
- [ ] measured outcomes are real
- [ ] unsupported metrics are removed
- [ ] repository is understandable
- [ ] demo is accessible
- [ ] technical interview walkthrough is prepared

---

## 67. Closing Principle

The implementation should not be judged by how many features or technologies it contains.

It should be judged by whether the final system demonstrates that its author can:

```text
understand a product problem
        ↓
design a solution
        ↓
define architecture
        ↓
implement it
        ↓
handle failure
        ↓
test it
        ↓
observe it
        ↓
deploy it
        ↓
explain the tradeoffs
```

That is the intended outcome of the Trading Analytics Platform project.

> **The implementation is the evidence. The architecture is the reasoning. The product is the result.**
