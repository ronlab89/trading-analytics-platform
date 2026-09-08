# Trading Analytics Platform
## SDD — 04. Technology Stack

**Status:** Draft  
**Version:** 1.0  
**Purpose:** Define the approved technology stack and technology-selection rules for the project.

---

# 1. Technology Strategy

Trading Analytics Platform must use a modern, production-oriented technology stack.

Technology choices should prioritize:

- maintainability;
- performance;
- developer experience;
- ecosystem maturity;
- strong TypeScript support;
- accessibility;
- testability;
- scalability;
- low operational complexity;
- free-tier compatibility.

The project must avoid technologies added solely to make the architecture appear more complex.

---

# 2. Version Policy

The project must use the **latest stable production-ready version available at implementation time** for approved technologies.

The implementation agent must:

1. verify the current stable version before installation;
2. avoid deprecated releases;
3. use compatible versions across the stack;
4. record exact installed versions in `package.json`;
5. document relevant version decisions when compatibility requires a non-latest version.

The project must not blindly upgrade dependencies after implementation if an upgrade introduces breaking changes.

Dependency updates should be deliberate and tested.

---

# 3. Language Strategy

TypeScript is the primary programming language.

It must be used across:

```text
Frontend
Backend
Shared Contracts
Domain Logic
Mock Infrastructure
Testing
Tooling where practical
```

JavaScript should only appear where required by external tooling or configuration.

The project should use strict TypeScript configuration.

---

# 4. Frontend Stack

## 4.1 React

React is the primary frontend framework/library.

Responsibilities:

- component rendering;
- UI composition;
- application interaction;
- feature presentation;
- accessibility-oriented interfaces.

React should not contain domain logic that can exist independently from presentation.

---

# 5. Frontend Build Tool

## Vite

Vite is the frontend build and development tool.

Responsibilities:

- development server;
- bundling;
- environment handling;
- production builds;
- optimized asset delivery.

The project should use Vite rather than introducing a heavier full-stack framework unless a concrete requirement appears.

---

# 6. TypeScript

TypeScript is mandatory for frontend development.

Configuration should use strict type checking.

Important goals:

- no implicit `any`;
- explicit API contracts;
- strongly typed domain models;
- typed hooks;
- typed repositories;
- typed events;
- typed forms.

---

# 7. Styling

## Tailwind CSS

Tailwind CSS is the primary styling system.

Responsibilities:

- layout;
- responsive design;
- spacing;
- typography;
- visual states;
- design tokens;
- component styling.

The project should avoid uncontrolled global CSS.

---

# 8. UI Components

## shadcn/ui

shadcn/ui will provide accessible, composable UI primitives.

Examples:

- Dialog;
- Dropdown;
- Select;
- Tabs;
- Tooltip;
- Popover;
- Toast;
- Button;
- Input;
- Table primitives.

Components should be customized to match the product's visual identity.

The product must not look like an unmodified shadcn/ui template.

---

# 9. Animation

## Framer Motion

Framer Motion will handle UI motion and interaction animation.

Use cases:

- page transitions;
- modal transitions;
- panel transitions;
- state changes;
- micro-interactions;
- loading transitions;
- realtime visual feedback.

Animations must respect:

```text
prefers-reduced-motion
```

Animation should improve comprehension rather than add decoration.

---

# 10. Server State

## TanStack Query

TanStack Query is the standard server-state management solution.

Responsibilities:

- API requests;
- caching;
- query invalidation;
- retries;
- mutations;
- loading states;
- error states;
- background synchronization.

Server data should not be duplicated into Zustand unless there is a specific architectural reason.

---

# 11. Client State

## Zustand

Zustand is the primary client-state management solution.

Use cases:

- UI state;
- selected portfolio;
- filters;
- simulation controls;
- realtime connection state;
- replay controls;
- temporary interaction state.

Zustand should not become a generic replacement for server-state management.

---

# 12. Tables

## TanStack Table

TanStack Table must be used for complex data tables.

Expected use cases:

- transactions;
- positions;
- portfolios;
- assets;
- decisions;
- scenarios;
- analytics datasets.

Required capabilities may include:

- sorting;
- filtering;
- column visibility;
- pagination;
- row selection;
- column definitions;
- responsive behavior;
- virtualization when necessary.

The table library must remain separated from domain logic.

---

# 13. Forms

## React Hook Form

React Hook Form will manage complex interactive forms.

Use cases:

- portfolio creation;
- transaction creation;
- decision creation;
- scenario configuration;
- alerts;
- user preferences.

Forms should remain controlled through explicit schemas.

---

# 14. Validation

## Zod

Zod will be used for runtime validation and schema definition.

Responsibilities:

- form validation;
- API response validation where appropriate;
- API request validation;
- realtime event validation;
- environment configuration validation;
- shared contracts.

Schemas should become a source of truth where practical.

---

# 15. API Contract Types

API contracts should be strongly typed.

The preferred strategy is to avoid manually maintaining unrelated frontend/backend types.

Where practical:

```text
Shared Schema
      ↓
Frontend Types
      +
Backend Types
```

The exact code-sharing strategy will be determined during implementation.

---

# 16. Charts and Data Visualization

The application requires performant financial visualization.

The charting solution must support:

- candlestick charts;
- line charts;
- area charts;
- performance curves;
- allocation visualization;
- interactive tooltips;
- large datasets;
- realtime updates.

The implementation should prefer a **Canvas-based rendering approach** for high-frequency and large-volume visualizations.

The final chart library must be selected based on:

- current maintenance;
- TypeScript support;
- rendering performance;
- interaction quality;
- bundle impact;
- license;
- free usage;
- ability to operate without paid services.

The chart library must not require a paid API.

---

# 17. Backend Runtime

## Node.js

Node.js is the backend runtime.

The project must use the latest stable LTS-compatible release available at implementation time.

Node.js will run:

- API server;
- application services;
- realtime server;
- background processing;
- development tooling where applicable.

---

# 18. Backend Language

## TypeScript

The backend must be written entirely in TypeScript.

This includes:

```text
Controllers
Services
Repositories
Domain Logic
DTOs
Validation
Realtime Events
Jobs
Tests
Configuration
```

The backend must use strict TypeScript settings.

---

# 19. Backend Framework

## Express

Express will provide the HTTP application layer.

Responsibilities:

- routing;
- middleware;
- request handling;
- authentication middleware;
- authorization middleware;
- validation;
- error handling.

Business logic must remain outside Express controllers.

---

# 20. API Architecture

The backend will expose REST APIs.

Architecture:

```text
HTTP
 ↓
Controller
 ↓
Application Service
 ↓
Domain
 ↓
Repository
 ↓
Infrastructure
```

Controllers should remain thin.

---

# 21. API Documentation

## OpenAPI

The API must have an OpenAPI specification.

The specification should describe:

- endpoints;
- parameters;
- request bodies;
- responses;
- errors;
- authentication;
- schemas;
- examples.

The implementation may use a compatible OpenAPI tooling library.

---

# 22. Realtime

## WebSockets

WebSockets are the production realtime transport.

Use cases:

- market updates;
- portfolio updates;
- job progress;
- notifications;
- alerts;
- connection state.

The application must not directly depend on a WebSocket library.

A transport abstraction must exist.

---

# 23. Authentication

Authentication will use JWT-based sessions.

Architecture:

```text
Credentials
    ↓
Authentication
    ↓
JWT
    ↓
Authenticated Request
    ↓
Identity
```

The implementation should use short-lived access tokens and an appropriate refresh strategy where required.

Secrets must never be committed to source control.

---

# 24. Authorization

Authorization will use RBAC.

Initial conceptual roles:

```text
TRADER
ANALYST
ADMIN
```

The exact role model will be defined by the authorization requirements.

Authorization checks must occur server-side.

Frontend role checks exist only to improve UX.

---

# 25. Authentication Library Policy

A dedicated authentication framework such as Auth.js is **not required for the initial architecture**.

Reason:

- authentication requirements are relatively focused;
- backend API authorization is central to the product;
- JWT + RBAC provides sufficient architectural depth;
- introducing a large authentication abstraction would add complexity without solving a current requirement.

A dedicated authentication provider may be introduced in the future if requirements expand to include:

- OAuth providers;
- enterprise SSO;
- social login;
- advanced identity management;
- external identity federation.

Such a change must be documented as an ADR.

---

# 26. Password Security

If local credentials are implemented, passwords must never be stored directly.

The implementation must use a modern password hashing algorithm appropriate for authentication systems.

The exact library and parameters will be selected during implementation based on current security recommendations.

---

# 27. Database

## PostgreSQL

PostgreSQL is the preferred production database.

Reasons:

- relational integrity;
- transactional support;
- mature ecosystem;
- strong analytical capabilities;
- excellent TypeScript ecosystem;
- free-tier hosting options;
- suitable for portfolio/transaction relationships.

---

# 28. ORM / Database Access

## Prisma

Prisma will be used as the initial database access layer.

Responsibilities:

- schema definition;
- migrations;
- type-safe queries;
- relationship handling;
- database client generation.

Domain logic must not depend directly on Prisma.

Repositories isolate Prisma from the application layer.

---

# 28.1 Decimal Precision

## decimal.js

`decimal.js` is the approved library for arbitrary-precision decimal
arithmetic across the monorepo.

### Reason

- `05-data-model.md` §39 requires an explicit strategy to avoid unsafe
  floating-point behavior for authoritative monetary calculations.
- Prisma's `Decimal` type (used for PostgreSQL `Decimal` columns) is
  implemented on top of `decimal.js` internally. Standardizing on the
  same library across `packages/domain` and the persistence layer
  avoids unnecessary conversion friction between two different decimal
  representations (NFR-070).
- Zero recurring cost, no vendor lock-in, actively maintained,
  TypeScript-friendly (ships its own types).

### Usage

`decimal.js` must be used wherever a numeric value represents money or
requires precision beyond what IEEE 754 floats can safely guarantee
(prices, quantities used in financial calculations, portfolio metrics).

It must not be used for values with no precision requirement (IDs,
counts of unrelated things, UI-only display values).

---

# 29. Database Architecture

```text
Application
     ↓
Repository Interface
     ↓
Prisma Adapter
     ↓
PostgreSQL
```

This preserves database replaceability at the architectural level.

---

# 30. Mock Infrastructure

The public demo must not require PostgreSQL.

Demo data will use:

```text
Mock Repository
+
In-memory/session store
+
Simulation Engine
```

The mock implementation must satisfy the same application contracts as the production repositories.

---

# 31. Mock API / Network Simulation

The project may use **Mock Service Worker (MSW)** where network-level API interception is useful.

MSW can simulate:

- latency;
- HTTP errors;
- validation errors;
- timeouts;
- response payloads;
- API behavior.

However, MSW must complement rather than replace the application's repository/adapter architecture.

---

# 32. Simulation Engine

A custom TypeScript simulation engine will generate:

- market movements;
- realtime events;
- background job progress;
- alert triggers;
- connection failures;
- controlled event ordering scenarios.

The engine must remain deterministic when provided with a seed.

---

# 33. Testing Stack

Testing will use:

## Vitest

For:

- domain tests;
- application tests;
- utility tests;
- repository tests;
- simulation tests.

---

## Testing Library

Testing Library will be used for:

- React component tests;
- user interaction;
- accessibility-oriented assertions;
- state transitions.

---

## Playwright

Playwright will provide end-to-end testing.

Critical flows should include:

- authentication;
- portfolio creation;
- transaction creation;
- filtering;
- analytics;
- scenario calculation;
- decision replay;
- realtime updates;
- failure recovery.

---

# 34. Code Quality

## ESLint

ESLint will enforce:

- code quality;
- TypeScript rules;
- React rules;
- import boundaries;
- architectural restrictions.

---

# 35. Formatting

## Prettier

Prettier will provide consistent formatting.

Formatting should not be manually debated during feature development.

---

# 36. Architecture Enforcement

The project should use linting rules to enforce architectural boundaries.

Examples:

```text
domain
  X→ React

domain
  X→ Prisma

feature
  X→ infrastructure internals

presentation
  X→ database
```

The exact implementation may use ESLint import restrictions or an equivalent mechanism.

---

# 37. Package Manager

## pnpm

pnpm will be used as the package manager.

Reasons:

- efficient dependency management;
- workspace support;
- disk efficiency;
- good monorepo support;
- reproducible installations.

---

# 38. Repository Structure

The preferred project structure is:

```text
trading-analytics/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── contracts/
│   ├── domain/
│   ├── config/
│   └── ui/
│
├── docs/
│
├── tests/
│
├── docker/
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

The final structure may change if implementation evidence justifies it.

---

# 39. Monorepo Strategy

The project should use a monorepo if shared contracts and domain packages justify it.

Potential shared packages:

```text
@trading/contracts
@trading/domain
@trading/config
```

The frontend and backend should not share implementation details simply because they exist in the same repository.

Only genuinely shared code should be extracted.

---

# 40. Docker

Docker will be used for local infrastructure and reproducible development environments.

Potential services:

```text
postgres
api
```

The frontend may run outside Docker during development for faster feedback.

The final deployment strategy may use containers where appropriate.

---

# 41. CI/CD

## GitHub Actions

CI should validate:

```text
Install
 ↓
Typecheck
 ↓
Lint
 ↓
Unit Tests
 ↓
Integration Tests
 ↓
Build
```

End-to-end tests may run in a separate pipeline stage.

---

# 42. Environment Configuration

Environment variables must be validated at startup.

Examples:

```text
DATABASE_URL
JWT_SECRET
API_URL
WEBSOCKET_URL
NODE_ENV
```

Demo mode should have an explicit configuration flag.

Example:

```text
APP_MODE=demo
```

The final naming will be standardized during implementation.

---

# 43. Secrets

Secrets must:

- remain outside source control;
- use environment variables;
- be excluded from logs;
- never be embedded in frontend bundles;
- never be included in mock data.

The frontend must only receive public configuration.

---

# 44. Logging

The backend should use structured logging.

Logs should contain useful context such as:

```text
timestamp
level
requestId
module
event
duration
```

Sensitive information must not be logged.

---

# 45. Observability

The initial implementation should prioritize lightweight observability.

Required:

- structured logs;
- request IDs;
- health endpoint;
- error context;
- basic performance metrics.

External paid observability platforms are not required.

---

# 46. Hosting Requirements

The public demo must be deployable using free infrastructure.

The architecture must not require:

- paid API providers;
- paid financial market data;
- paid realtime infrastructure;
- paid databases;
- paid authentication;
- paid observability.

Production-like infrastructure may be demonstrated locally.

---

# 47. External Financial APIs

The application must not depend on paid financial APIs.

For the public demo:

```text
Market Data
    ↓
Simulation Engine
```

For production architecture:

```text
Market Data Provider
    ↓
External Adapter
    ↓
Application
```

The external provider must remain replaceable.

---

# 48. External Service Abstraction

Any future external provider must be isolated behind an adapter.

Example:

```text
MarketDataProvider
       │
       ├── MockMarketDataProvider
       └── ExternalMarketDataProvider
```

The application must not import a vendor SDK directly into domain logic.

---

# 49. Free-Tier Constraint

Cost is an architectural constraint.

The project must be able to run:

### Public Demo

```text
Static/client hosting
+
Mock infrastructure
+
Browser simulation
=
$0 operating cost
```

### Local Full Application

```text
Frontend
+
Node API
+
PostgreSQL
+
WebSockets
+
Docker
=
$0 operating cost
```

### Optional Cloud Deployment

Only free-tier-compatible services may be considered.

No architecture decision should assume a paid plan.

---

# 50. Browser-Only Demo

The public demo should preferably operate without a backend dependency.

This provides:

- zero server cost;
- high availability;
- no database consumption;
- no API rate limits;
- unlimited conceptual demo sessions;
- resilience against backend outages.

The browser executes:

```text
Mock API
+
Mock Repository
+
Simulation Engine
```

---

# 51. Technology Selection Rules

A new dependency should only be introduced when it provides meaningful value.

Before adding a dependency, evaluate:

1. Is the problem already solved by the current stack?
2. Does it reduce complexity?
3. Does it improve maintainability?
4. Does it have an active ecosystem?
5. Is it TypeScript-friendly?
6. Is it compatible with the free-tier requirement?
7. Does it create vendor lock-in?
8. Is it necessary for the product?

---

# 52. Prohibited Architectural Shortcuts

The implementation should not:

- put business logic directly into React components;
- access Prisma from frontend code;
- access databases from controllers;
- store all state in Zustand;
- bypass API contracts;
- hardcode financial calculations inside charts;
- make the demo a static collection of screenshots;
- use paid APIs for required functionality;
- introduce microservices without a concrete requirement;
- introduce authentication frameworks without a demonstrated need.

---

# 53. Approved Core Stack

The initial approved stack is:

```text
Frontend
├── React
├── TypeScript
├── Vite
├── Tailwind CSS
├── shadcn/ui
├── Framer Motion
├── TanStack Query
├── TanStack Table
├── Zustand
├── React Hook Form
└── Zod

Backend
├── Node.js
├── TypeScript
├── Express
├── REST
├── OpenAPI
├── JWT
└── RBAC

Data
├── PostgreSQL
└── Prisma

Realtime
└── WebSockets

Mock / Demo
├── Mock Repositories
├── MSW
└── Simulation Engine

Testing
├── Vitest
├── Testing Library
└── Playwright

Quality
├── ESLint
└── Prettier

Infrastructure
├── Docker
├── pnpm
└── GitHub Actions
```

---

# 54. Technology Decision Principle

The project should demonstrate:

> **Modern engineering through deliberate technology choices, not technology quantity.**

Every technology must have an identifiable responsibility.

The preferred architecture is therefore:

```text
React
   ↓
Application Contracts
   ↓
Domain
   ↓
Repository Interfaces
   ↓
Infrastructure
```

with:

```text
Real Infrastructure
        OR
Mock Infrastructure
```

being interchangeable without changing the core product behavior.

---

# 55. Stack Acceptance Criteria

The stack is considered approved when:

- frontend and backend use TypeScript;
- React/Vite provide the frontend foundation;
- Express/Node provide the backend foundation;
- TanStack Query manages server state;
- Zustand manages client state;
- TanStack Table manages complex tables;
- Zod provides validation;
- PostgreSQL provides persistence;
- Prisma isolates database access;
- WebSockets provide realtime transport;
- JWT + RBAC provide authentication/authorization;
- Vitest, Testing Library and Playwright cover testing needs;
- Docker supports local infrastructure;
- CI can run without paid services;
- the public demo can run entirely on mock infrastructure;
- no required external paid API exists.