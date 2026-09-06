# SDD 14 — Deployment Specification

**Project:** Trading Analytics Platform  
**Document:** Deployment Specification  
**Version:** 1.0  
**Status:** Specification  
**Previous document:** `13-observability-spec.md`  
**Next document:** `15-implementation-plan.md`

---

## 1. Purpose

This document defines how the Trading Analytics Platform is packaged, configured, started, validated, and deployed across local development, CI/test, public demo, and production-like environments.

The deployment strategy must preserve the architecture defined by the previous SDDs while remaining practical for a portfolio project and technical interview.

It must support:

- reproducible local setup
- Docker-based infrastructure
- isolated frontend/backend services
- PostgreSQL
- REST and WebSocket communication
- environment-based configuration
- database migrations and seeds
- health checks
- observability
- CI validation
- production builds
- free/no-recurring-cost development and demo paths
- separation between demo and real infrastructure

---

# 2. Deployment Principles

1. **Reproducible**
2. **Environment-aware**
3. **Configuration-driven**
4. **Container-friendly**
5. **Stateless application services where practical**
6. **Explicit database migrations**
7. **Observable**
8. **Deterministic builds**
9. **Secrets outside source control**
10. **Demo mode independent of paid infrastructure**
11. **Local architecture reasonably close to production**
12. **Complexity proportional to project needs**

Deployment is an infrastructure concern and should not leak into domain logic.

---

# 3. Deployment Targets

| Environment | Purpose |
|---|---|
| Local Development | Daily development |
| Test / CI | Automated validation |
| Demo | Public portfolio experience |
| Production-like | Deployment validation |

The same application artifacts should be reused whenever possible, with environment-specific configuration determining infrastructure.

```text
                    Source Code
                         │
                         ▼
                    Build / Test
                         │
             ┌───────────┼───────────┐
             │           │           │
           Local         CI       Deployable
             │                       │
             │              ┌────────┴────────┐
             │              │                 │
          Docker         Demo mode      Production-like
```

---

# 4. Local Development Architecture

Recommended topology:

```text
┌───────────────────────────────────────────────┐
│                 Local Machine                │
│                                               │
│  ┌──────────────┐                             │
│  │   Frontend   │                             │
│  │ React + Vite │                             │
│  └──────┬───────┘                             │
│         │ HTTP / WebSocket                    │
│         ▼                                     │
│  ┌──────────────┐                             │
│  │    API       │                             │
│  │ Node/Express │                             │
│  └──────┬───────┘                             │
│         │                                     │
│         ▼                                     │
│  ┌──────────────┐                             │
│  │  PostgreSQL  │                             │
│  └──────────────┘                             │
└───────────────────────────────────────────────┘
```

Docker should provide PostgreSQL and may provide the complete stack.

---

# 5. Docker Strategy

Docker is part of the reproducible development and deployment strategy.

At minimum:

```text
postgres
```

should be containerized.

A complete Compose environment may contain:

```text
frontend
backend
postgres
```

Additional infrastructure must only be introduced when justified.

---

# 6. Docker Compose

Docker Compose should be the primary local orchestration mechanism.

It should support:

- startup/shutdown
- service networking
- health dependencies
- environment variables
- persistent PostgreSQL volume
- isolated database state
- development workflow

Conceptual structure:

```yaml
services:
  frontend:
  backend:
  postgres:
```

Exact configuration belongs to implementation.

---

# 7. Service Responsibilities

### Frontend

- React application
- user interface
- API communication
- WebSocket connection
- production static build

### Backend

- REST API
- authentication
- authorization
- application/domain orchestration
- PostgreSQL access
- WebSocket server
- background operations
- health checks
- observability

### PostgreSQL

- persistent relational data
- transactions
- constraints
- indexes
- migrations

---

# 8. Container Networking

Containers should communicate through an internal network.

```text
frontend ──HTTP────► backend
frontend ──WS──────► backend
backend  ──────────► postgres
```

Docker-internal hostnames must never be exposed as browser configuration.

---

# 9. Port Strategy

Local ports must be predictable and documented.

Suggested defaults:

```text
Frontend: 5173
Backend:  3000
Database: 5432
```

These are defaults, not architectural requirements.

---

# 10. Environment Configuration

Configuration must be externalized.

Conceptual variables:

```text
NODE_ENV
PORT
DATABASE_URL
CORS_ORIGIN
JWT_SECRET
JWT_EXPIRES_IN
WEBSOCKET_PATH
LOG_LEVEL
DEMO_MODE
```

The final variable list is established during implementation.

Configuration, secrets, code and runtime state must remain separate concerns.

---

# 11. Environment Files

Local development may use:

```text
.env
.env.example
```

`.env.example` must contain placeholders only.

Real secrets must never be committed.

The repository must document which variables are required for:

- local development
- tests
- demo
- production-like deployment

---

# 12. Configuration Validation

Backend configuration must be validated at startup.

```text
Process starts
      │
      ▼
Load environment
      │
      ▼
Validate configuration
      │
      ├── invalid → fail fast
      │
      └── valid
            │
            ▼
      initialize services
```

Invalid configuration should prevent the service from accepting traffic.

---

# 13. Secrets Management

Secrets include:

- JWT signing secrets
- database passwords
- private keys
- deployment credentials
- future provider credentials

Secrets must be injected at runtime through environment/deployment secret mechanisms.

Never:

- commit secrets
- place server secrets in frontend variables
- print secrets in logs
- expose credentials through health endpoints
- include real credentials in examples

---

# 14. Frontend Configuration

Only public configuration may be exposed to the frontend.

Examples:

- API base URL
- WebSocket URL
- public environment identifier
- demo configuration

Never expose:

```text
JWT_SECRET
DATABASE_URL
private API keys
server credentials
```

Vite variables must be treated as public unless explicitly guaranteed otherwise.

---

# 15. Backend Startup Sequence

Recommended lifecycle:

```text
Process starts
     ↓
Load configuration
     ↓
Validate configuration
     ↓
Initialize observability
     ↓
Initialize database
     ↓
Validate dependencies
     ↓
Initialize application services
     ↓
Initialize HTTP server
     ↓
Initialize WebSocket layer
     ↓
Expose readiness
```

Exact ordering may be adjusted during implementation.

---

# 16. Graceful Shutdown

The backend must support graceful shutdown.

```text
Shutdown signal
      ↓
Stop accepting new work
      ↓
Stop new background jobs
      ↓
Handle realtime connections
      ↓
Finish/cancel active operations safely
      ↓
Close database pool
      ↓
Flush critical diagnostics
      ↓
Exit
```

The implementation should handle appropriate Node.js termination signals.

---

# 17. Database Deployment

PostgreSQL is the primary persistent database.

Deployment must define:

- database creation
- migrations
- seeds
- connection configuration
- pool configuration
- reset process
- production backup expectations

---

# 18. Database Migrations

Schema changes must be versioned.

The project must use a migration system that supports:

- applying migrations
- checking migration state
- controlled rollback where safe

Manual production schema edits are not an acceptable normal workflow.

```text
Model change
    ↓
Migration
    ↓
Local validation
    ↓
Tests
    ↓
CI
    ↓
Deployment
```

---

# 19. Migration Safety

Migrations must be:

- deterministic
- reviewed
- tested
- explicit about destructive changes
- compatible with application deployment sequencing where possible

Destructive migrations must not be introduced casually.

A forward-compatible migration can be safer than an immediate rollback when data has already changed.

---

# 20. Seed Data

Development/test environments should support controlled seed data.

It may include:

- users
- roles
- portfolios
- positions
- transactions
- instruments
- analytics history

Seed data must be coherent enough to exercise primary product flows.

It must remain separate from the browser-only/mock Demo Mode infrastructure.

---

# 21. Database Reset

Local development should provide a documented reset workflow:

```text
Reset
 ↓
Recreate schema
 ↓
Run migrations
 ↓
Seed
```

This must be clearly separated from production operations.

---

# 22. Demo Deployment

The public demo must not require the complete real infrastructure when unnecessary.

It follows the infrastructure substitution strategy defined in `12-demo-mode-spec.md`.

```text
Public Demo
    ↓
React application
    ↓
Mock adapters
    ├── mock API
    ├── local persistence
    ├── simulated latency/failures
    └── simulated realtime
```

The demo remains a functional product experience, not a static mockup.

---

# 23. Demo vs Real Infrastructure

Application and domain behavior should remain shared.

```text
                    Application
                         │
                ┌────────┴────────┐
                │                 │
             Demo              Real
                │                 │
         Mock adapters       Real adapters
                │                 │
        Simulation          API/PostgreSQL
```

The composition root selects the infrastructure.

---

# 24. Public Demo Safety

The public demo must not expose:

- server credentials
- private database access
- administrative operations
- development stack traces
- unrestricted diagnostic information
- private data

Public demo simulations must have bounded resource usage.

---

# 25. Backend Deployment

The backend must be deployable as a standalone Node.js service or Docker container.

The runtime artifact should contain:

- compiled application
- production dependencies
- runtime configuration

Development-only dependencies should not be required in production.

---

# 26. Backend Container

A production container should prioritize:

- reproducibility
- predictable startup
- minimal runtime dependencies
- non-root execution where practical
- health checks
- graceful shutdown

A multi-stage Docker build should be considered:

```text
Build stage
 ├── install
 ├── type check
 └── build

Runtime stage
 ├── production dependencies
 └── compiled application
```

---

# 27. Frontend Production Build

The frontend should produce static assets:

```text
React source
    ↓
Vite build
    ↓
Static assets
    ↓
Static hosting / web server
```

A Node.js runtime is not required to serve static assets unless the selected deployment architecture chooses one.

---

# 28. Frontend Hosting

The frontend should be compatible with free/static hosting.

Required characteristics:

- HTTPS
- static assets
- SPA fallback where necessary
- configurable API origin
- Git-based deployment where useful

The architecture must not depend on one specific hosting provider.

---

# 29. Backend Hosting

The backend requires a runtime that supports:

- Node.js or Docker
- HTTP
- WebSockets
- environment variables/secrets
- PostgreSQL connectivity
- health checks

Before actual deployment, current provider limits and WebSocket support must be verified.

No provider should be presented as permanently free because hosting policies can change.

---

# 30. Database Hosting

Local:

```text
PostgreSQL → Docker
```

Public/production-like:

```text
Application → Managed PostgreSQL
```

A free development tier may be preferred, but the architecture remains provider-agnostic.

---

# 31. WebSocket Deployment

The selected deployment environment must support:

- persistent WebSocket connections
- connection upgrades
- appropriate timeout behavior
- reconnects
- required proxy configuration

If a provider cannot reliably support WebSockets, it is not a valid target for the realtime production-like deployment.

Local Docker must remain a reliable fallback.

---

# 32. Reverse Proxy

A reverse proxy may provide:

```text
Browser
   ↓
HTTPS / WSS
   ↓
Reverse Proxy
   ↓
Backend
```

A dedicated proxy is not mandatory if the hosting platform already provides equivalent routing and TLS behavior.

---

# 33. CORS

CORS must be explicit.

Development may allow the local frontend origin.

Production should allow only configured trusted origins.

Avoid wildcard CORS for authenticated APIs unless there is a specific, justified requirement.

---

# 34. HTTPS and WebSockets

Public environments must use HTTPS.

Corresponding realtime transport should use:

```text
HTTPS → WSS
```

Mixed-content requests must be avoided.

---

# 35. Authentication Deployment

JWT authentication requires a server-side signing secret.

Requirements:

- secret supplied at runtime
- never exposed to frontend
- expiration configured
- server-side validation
- safe authentication logging
- secure deployment configuration

Changing the signing secret should be treated as an operational event.

---

# 36. RBAC Deployment

Authorization is a backend security boundary.

```text
Frontend role check
    → UX convenience

Backend role check
    → Security enforcement
```

Frontend visibility cannot replace backend authorization.

---

# 37. Build Reproducibility

Builds should use:

- committed lockfile
- explicit Node.js version
- consistent package manager
- deterministic commands
- shared TypeScript configuration

The Node.js version should target a current supported LTS release when implementation begins.

---

# 38. Package Management

One package manager must be selected and documented.

The lockfile must be committed.

Local and CI environments should resolve dependencies using the same strategy.

---

# 39. Repository Structure

If frontend and backend share a repository, their boundaries should be explicit.

Conceptual structure:

```text
/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── shared/
│   └── config/
├── docs/
├── docker/
├── scripts/
└── package.json
```

The exact structure belongs to `15-implementation-plan.md` and implementation.

---

# 40. Shared Types

Shared TypeScript contracts should originate from API/domain boundaries, not from UI implementation.

Preferred:

```text
API contract
    ├── backend
    └── frontend
```

Avoid making backend domain code depend on frontend types.

---

# 41. CI Pipeline

CI should validate meaningful changes.

Recommended pipeline:

```text
Install
  ↓
Lint
  ↓
Type Check
  ↓
Unit Tests
  ↓
Integration Tests
  ↓
Build
  ↓
E2E Tests
  ↓
Artifact validation
```

Execution order may be optimized for speed.

---

# 42. CI Database

Integration tests must use an isolated disposable PostgreSQL instance.

Possible approaches:

- Docker service
- CI PostgreSQL service
- test container

CI must never use a production database.

---

# 43. CI Environment

CI should define:

- Node.js version
- package manager
- test mode
- database configuration
- deterministic seed data
- required non-secret variables

Secrets should use the CI platform's secret store if necessary.

---

# 44. Build Artifacts

CI may produce:

- frontend build
- backend build
- Docker image
- test reports
- coverage reports

Generated artifacts should not be committed to Git.

---

# 45. Deployment Pipeline

A simple deployment flow:

```text
Git push
   ↓
CI validation
   ↓
Build
   ↓
Package/artifact
   ↓
Deploy
   ↓
Database migration
   ↓
Health check
   ↓
Smoke test
```

The pipeline should remain simple enough to maintain independently.

---

# 46. Deployment Ordering

Deployment must consider compatibility between:

- application version
- database schema
- API contract
- frontend version

Where practical, migrations should support compatibility during rollout.

Complex zero-downtime orchestration is not required for the initial project.

---

# 47. Rollback

Rollback must be considered separately for:

### Application

Redeploy a known-good artifact.

### Frontend

Restore a previous static build.

### Database

Rollback only when safe and supported by the migration/data model.

Database rollback is not automatically equivalent to application rollback.

---

# 48. Deployment Verification

A deployment is not successful merely because a process starts.

Verify:

```text
Frontend loads
    ↓
API reachable
    ↓
Database ready
    ↓
Authentication works
    ↓
Core API flow works
    ↓
WebSocket connects
    ↓
Health reports expected state
```

---

# 49. Smoke Tests

Minimum smoke tests should verify:

1. frontend accessibility
2. API health
3. authentication
4. authenticated request
5. primary portfolio flow
6. realtime connection
7. expected error handling

---

# 50. Health Checks

The deployment must preserve the health model from `13-observability-spec.md`.

Recommended endpoints:

```text
GET /health
GET /health/ready
```

Liveness should answer whether the process is alive.

Readiness should answer whether required dependencies are available.

Health responses must never expose credentials or internal secrets.

---

# 51. Container Health

A container can be running while the application is unusable.

Therefore health checks should distinguish:

```text
Process running
```

from:

```text
Application ready
```

The deployment platform should use readiness information where supported.

---

# 52. Startup Diagnostics

Startup should produce safe structured events such as:

```text
service.starting
configuration.validated
database.connected
application.initialized
http.ready
websocket.ready
service.ready
```

Startup failures must be visible through the observability system.

---

# 53. Observability During Deployment

Deployment must preserve:

- structured logs
- request IDs
- error diagnostics
- health checks
- metrics where implemented
- realtime diagnostics

See `13-observability-spec.md`.

A deployment that cannot be diagnosed is incomplete.

---

# 54. Background Jobs

If background jobs execute in the API process, deployment must account for:

- graceful shutdown
- duplicate execution
- cancellation
- timeouts
- process restarts

A future worker architecture may be:

```text
API
 ↓
Queue
 ↓
Worker
```

A separate worker is not required initially unless justified.

---

# 55. Demo Background Jobs

Demo jobs must not require a production queue service.

They should use the simulation infrastructure from `12-demo-mode-spec.md` and still demonstrate:

- progress
- completion
- failure
- cancellation
- timeout

---

# 56. Demo Persistence

Demo state should remain isolated from production data.

The public demo should not be able to modify:

- real user records
- real portfolios
- real database state
- private application data

---

# 57. Local Production-like Mode

A production-like local mode should validate:

- production builds
- environment variables
- containers
- migrations
- health checks
- realtime
- startup/shutdown

Conceptually:

```text
Docker Compose
 ├── frontend build
 ├── backend build
 ├── PostgreSQL
 └── production configuration
```

---

# 58. Dependency Security

The project should:

- commit lockfiles
- review dependency updates
- remove unused packages
- run vulnerability checks when practical
- keep production dependencies minimal

No dependency should be added only for appearance.

---

# 59. Runtime Versions

Node.js and PostgreSQL versions must be explicitly documented and pinned for local development.

The versions should be selected from currently supported releases when implementation begins.

Local, CI and production-like environments should remain compatible.

---

# 60. Time and Timezone

The deployment environment should use UTC where practical.

Recommended strategy:

- store timestamps in UTC
- serialize consistently
- convert to user-local time in the UI
- do not depend on server-local timezone

This is important for trading data and historical analytics.

---

# 61. File Handling

If files are generated or delivered:

```text
Generate
  ↓
Deliver
  ↓
Cleanup
```

Ephemeral container storage must not be treated as durable storage.

Persistent file storage should be introduced through an infrastructure adapter if required later.

---

# 62. External APIs

External market-data services are optional.

If introduced:

```text
Application
    ↓
Market Data Adapter
    ↓
Provider
```

Credentials remain server-side.

Demo Mode must not depend on external market-data availability.

---

# 63. Rate Limiting

Rate limiting should be considered for:

- authentication
- expensive analytics
- public endpoints
- resource-intensive operations

Exact limits should be based on the deployed environment and validated during implementation.

Rate limiting must not break local development or CI.

---

# 64. Public Demo Traffic

Public traffic must be treated as untrusted.

The application should protect against:

- arbitrary file access
- unauthorized administration
- private data access
- uncontrolled resource consumption
- abusive simulation requests

Demo resources should remain bounded.

---

# 65. Resource Limits

Reasonable limits should exist for:

- request body size
- upload size if applicable
- pagination size
- analytics query scope
- background job duration
- realtime history
- demo history
- database query limits

These limits protect both local and public deployments.

---

# 66. Database Pooling

The backend should use controlled PostgreSQL connection pooling.

Pool size must reflect the actual deployment capacity.

It should not exceed what the database instance can safely support.

Exact values are implementation decisions, not universal performance guarantees.

---

# 67. Horizontal Scaling

The initial backend may run as a single instance.

The architecture should nevertheless avoid unnecessary process-local assumptions.

Future topology:

```text
Load Balancer
 ├── API 1
 ├── API 2
 └── API 3
       │
       ▼
   PostgreSQL
```

Realtime scaling may later require shared coordination.

---

# 68. Realtime Scaling Boundary

A multi-instance WebSocket deployment may require a shared event mechanism:

```text
API instances
      ↓
Realtime broker/pub-sub
      ↓
Connected clients
```

The current realtime implementation should remain behind an abstraction to permit this evolution.

---

# 69. CDN and Static Assets

The frontend should be compatible with CDN/static hosting.

Use:

- content-hashed assets
- cacheable immutable files
- controlled HTML caching
- explicit API origin configuration

Exact caching headers depend on the host.

---

# 70. SPA Routing

Static hosting must support client-side routes such as:

```text
/dashboard
/portfolio/123
/analytics
```

Unknown application paths should resolve to the frontend entry point rather than a server 404.

The required host-specific fallback must be documented.

---

# 71. API Versioning

The API should have a consistent versioning strategy.

A possible initial strategy:

```text
/api/v1/...
```

Final routes must remain aligned with `06-api-spec.md`.

---

# 72. WebSocket Configuration

The WebSocket endpoint must be environment-aware.

Conceptually:

```text
Development:
ws://localhost:<port>/<path>

Production:
wss://<configured-domain>/<path>
```

The exact endpoint is finalized during implementation.

---

# 73. Backups

Local development does not require formal backups.

A production-like persistent deployment should have a documented backup and restoration strategy if real user data exists.

The project must not claim backup coverage until it has actually been configured and tested.

---

# 74. Disaster Recovery

Enterprise disaster recovery is out of scope.

A practical recovery sequence should nevertheless be documented:

```text
Restore database
   ↓
Run compatible application
   ↓
Validate migrations
   ↓
Start services
   ↓
Health checks
   ↓
Smoke tests
```

---

# 75. Troubleshooting

Documentation should cover common failures.

### Database unavailable

Check:

- PostgreSQL service
- connection URL
- credentials
- network
- readiness

### Backend does not start

Check:

- environment variables
- Node.js version
- build output
- migration state
- logs

### Frontend cannot reach API

Check:

- API base URL
- CORS
- backend health
- browser network panel

### WebSocket fails

Check:

- endpoint
- WS/WSS scheme
- proxy support
- server upgrade support
- browser console
- reconnect diagnostics

---

# 76. Local Setup

The documented setup should follow approximately:

```text
Clone
 ↓
Install dependencies
 ↓
Create environment file
 ↓
Start PostgreSQL
 ↓
Run migrations
 ↓
Seed development data
 ↓
Start backend
 ↓
Start frontend
 ↓
Open application
```

Exact commands belong in repository documentation.

---

# 77. Production Setup

Production-like deployment should follow:

```text
Provision infrastructure
 ↓
Configure secrets
 ↓
Build artifacts
 ↓
Run migrations
 ↓
Start backend
 ↓
Deploy frontend
 ↓
Verify health
 ↓
Verify realtime
 ↓
Run smoke tests
```

---

# 78. Security Checklist

Before public deployment:

- [ ] No secrets committed
- [ ] Production JWT secret configured
- [ ] Database credentials protected
- [ ] CORS restricted
- [ ] HTTPS enabled
- [ ] Debug mode disabled
- [ ] Stack traces hidden
- [ ] Health output sanitized
- [ ] Metrics restricted if exposed
- [ ] Admin operations protected
- [ ] Rate limits considered
- [ ] Resource limits configured
- [ ] Demo data isolated
- [ ] Dependencies reviewed

---

# 79. Performance Checklist

Before deployment:

- [ ] Production frontend build succeeds
- [ ] Production backend build succeeds
- [ ] Development dependencies excluded where appropriate
- [ ] Static assets optimized
- [ ] Required indexes exist
- [ ] Pagination limits enforced
- [ ] Realtime history bounded
- [ ] Background jobs have timeouts
- [ ] Logging volume controlled

No performance claim should be published without actual measurement.

---

# 80. Deployment Observability Checklist

Verify:

- [ ] startup logs
- [ ] request IDs
- [ ] error logging
- [ ] health endpoint
- [ ] readiness checks
- [ ] database health
- [ ] realtime lifecycle diagnostics
- [ ] background job diagnostics
- [ ] metrics where implemented
- [ ] safe production log level

---

# 81. Deployment Testing Matrix

| Test | Local | CI | Demo | Production-like |
|---|---:|---:|---:|---:|
| Unit | ✓ | ✓ | - | - |
| Integration | ✓ | ✓ | - | ✓ |
| E2E | ✓ | ✓ | ✓ | ✓ |
| Migrations | ✓ | ✓ | N/A/isolated | ✓ |
| Health | ✓ | ✓ | ✓ | ✓ |
| Realtime | ✓ | ✓ | ✓ | ✓ |
| Demo simulation | ✓ | ✓ | ✓ | Optional |
| Production build | ✓ | ✓ | ✓ | ✓ |
| Smoke tests | Optional | Optional | ✓ | ✓ |

---

# 82. Deployment Acceptance Criteria

The architecture is acceptable when:

1. A new developer can run the application using documented steps.
2. PostgreSQL starts reproducibly.
3. Migrations are deterministic.
4. Backend and frontend can be built independently.
5. Configuration is externalized.
6. Secrets are not committed.
7. Health reflects real service state.
8. WebSockets work in the supported deployment environment.
9. Demo Mode works without paid external infrastructure.
10. CI validates the application from a clean environment.
11. Production-like builds can be tested locally.
12. Deployment failures can be diagnosed through observability.
13. Rollback considerations are documented.
14. The architecture is not tied to one hosting vendor.

---

# 83. Definition of Done

### Local
- [ ] Docker setup implemented
- [ ] PostgreSQL reproducible
- [ ] frontend starts
- [ ] backend starts
- [ ] WebSockets work
- [ ] environment setup documented

### Database
- [ ] migration system implemented
- [ ] seed process documented
- [ ] reset process documented
- [ ] database version pinned

### Build
- [ ] frontend production build works
- [ ] backend production build works
- [ ] lockfile committed
- [ ] runtime versions documented

### CI
- [ ] lint passes
- [ ] type checking passes
- [ ] unit tests pass
- [ ] integration tests pass
- [ ] build passes
- [ ] E2E strategy configured

### Deployment
- [ ] frontend target defined
- [ ] backend target defined
- [ ] database target defined
- [ ] secrets strategy documented
- [ ] health checks available
- [ ] smoke tests defined

### Realtime
- [ ] endpoint configurable
- [ ] WSS supported publicly
- [ ] hosting requirements documented
- [ ] reconnect behavior preserved

### Demo
- [ ] no paid infrastructure required
- [ ] infrastructure isolated
- [ ] simulation follows `12-demo-mode-spec.md`
- [ ] private infrastructure not exposed

### Operations
- [ ] graceful shutdown works
- [ ] startup failures are observable
- [ ] deployment verification documented
- [ ] troubleshooting documented

---

# 84. Deployment Tradeoffs

The initial architecture intentionally does **not** require:

- Kubernetes
- Terraform
- service meshes
- distributed queues
- dedicated observability clusters
- multi-region deployment
- autoscaling infrastructure
- dedicated worker fleets

These may be appropriate in a larger system, but adding them here would increase complexity without proportionate value.

The deployment should demonstrate sound engineering rather than infrastructure for its own sake.

---

# 85. Free / Low-Cost Strategy

The project should prioritize infrastructure that can run at no recurring cost during development and portfolio demonstration.

Hosting plans and free tiers can change, therefore:

- verify current limits before deployment
- do not claim permanent free hosting
- keep architecture provider-agnostic
- retain local Docker as the canonical fallback

Distinguish between:

```text
Architecture requirement
```

and:

```text
Current provider choice
```

---

# 86. Provider Selection Criteria

### Frontend

- static hosting
- HTTPS
- SPA fallback
- environment configuration
- Git deployment

### Backend

- Node.js/Docker
- HTTP
- WebSockets
- secrets
- health checks
- suitable resource limits

### Database

- PostgreSQL
- reliable connections
- appropriate limits
- free/development availability
- backups when required

Providers must be evaluated against actual project requirements.

---

# 87. Vendor Independence

Infrastructure integrations should be encapsulated.

The following must not require vendor-specific application logic unless isolated behind adapters:

- database
- realtime
- file storage
- observability
- external APIs

This preserves portability.

---

# 88. Architecture Relationship

Deployment reflects the application boundaries:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↓
Infrastructure
     ↓
Deployment
```

Domain logic should not know whether it runs locally, in Docker, in a demo, or in a cloud environment.

---

# 89. Observability Relationship

Deployment must preserve the capabilities from `13-observability-spec.md`:

```text
Deployment
 ├── startup logs
 ├── request correlation
 ├── health
 ├── metrics
 └── runtime errors
```

Observability is part of deployment readiness.

---

# 90. Testing Relationship

The deployment artifact should be validated as an executable system:

```text
Build
 ↓
Test
 ↓
Package
 ↓
Run
 ↓
Health
 ↓
Smoke
```

This reduces the difference between “the code builds” and “the deployed system works.”

---

# 91. Demo Relationship

Demo deployment is a deployment target, not a separate product.

```text
Real:
API + PostgreSQL + WebSocket

Demo:
Mock API + browser persistence + simulated realtime
```

Application behavior remains conceptually aligned.

---

# 92. Technical Interview Demonstration

A concise deployment walkthrough should demonstrate:

1. Start local services.
2. Show frontend, backend and PostgreSQL.
3. Run/inspect migrations.
4. Open health endpoint.
5. Demonstrate realtime.
6. Trigger an observable operation.
7. Show production build.
8. Explain how the same architecture maps to public deployment.
9. Demonstrate Demo Mode as an infrastructure substitution.

This communicates engineering maturity without unnecessary cloud complexity.

---

# 93. Future Evolution

Possible future deployment capabilities:

- dedicated worker
- Redis/pub-sub
- managed observability
- container registry
- infrastructure as code
- automated backups
- zero-downtime deployments
- blue/green deployments
- horizontal API scaling
- CDN optimization
- managed secrets
- distributed tracing

These are future capabilities, not minimum requirements.

---

# 94. Final Deployment Principle

> **The environment may change; the application's engineering boundaries should not.**

The system should move through:

```text
Developer laptop
      ↓
Docker
      ↓
CI
      ↓
Demo
      ↓
Production-like environment
```

without rewriting the product.

Deployment is therefore treated as another infrastructure boundary.

The application remains focused on domain behavior and communicates with its environment through configuration and infrastructure adapters.

---

# 95. Final Deployment Model

```text
                         Git Repository
                              │
                              ▼
                         CI Pipeline
                              │
                    ┌─────────┴─────────┐
                    │                   │
                Validation            Build
                    │                   │
                    └─────────┬─────────┘
                              │
                        Deployable
                         Artifacts
                              │
               ┌──────────────┼──────────────┐
               │              │              │
             Local           Demo        Production
               │              │              │
          Docker stack   Demo adapters   Real adapters
               │              │              │
          PostgreSQL       Browser        PostgreSQL
          WebSocket       simulation      WebSocket
          API             persistence     external infra
```

The deployment strategy demonstrates:

- reproducibility
- containerization
- environment separation
- database migrations
- secure configuration
- CI
- health checks
- realtime deployment
- graceful shutdown
- production awareness
- vendor independence

without introducing infrastructure whose complexity is not justified by the project.

---

# 96. Relationship to Other SDDs

This document depends on and complements:

- `00-overview.md` — project scope and principles
- `01-product-spec.md` — product behavior
- `02-functional-requirements.md` — functional requirements
- `03-non-functional-requirements.md` — quality attributes
- `04-tech-stack.md` — technical stack
- `05-architecture.md` — application architecture
- `06-api-spec.md` — API contracts
- `07-realtime-spec.md` — realtime architecture
- `09-*.md` — supporting technical specification
- `10-testing-strategy.md` — testing strategy
- `11-ui-ux-spec.md` — UX behavior
- `12-demo-mode-spec.md` — demo infrastructure
- `13-observability-spec.md` — logs, metrics, health and diagnostics

The next document, `15-implementation-plan.md`, will translate the complete SDD set into an ordered implementation roadmap with phases, dependencies, milestones, validation points and delivery sequencing.

---

# Document Status

**Status:** Ready for implementation alignment

This document defines the target deployment architecture. Specific hosting providers, exact runtime versions, CI configuration, environment variable names and deployment commands may be finalized during implementation as long as they preserve the principles and acceptance criteria defined here.
