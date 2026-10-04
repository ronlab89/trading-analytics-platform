# ADR-001: Application Layer as a Shared, Injectable Package

**Status:** Accepted
**Date:** 2026-10-04
**Implemented in:** roadmap block B0 (not yet implemented)

## Context

The product must run in two modes that share behavior: the real full-stack
application and a public demo on mocked infrastructure.
`12-demo-mode-spec.md` §87-88 requires the demo to share the application use
cases and replace only the repositories, not to reimplement a fake backend.

The current backend cannot support that:

- The 14 modules in `apps/api/src/services/` instantiate Prisma repositories
  at module level (for example
  `const portfolioRepository = new PrismaPortfolioRepository()`). No other
  implementation can be supplied.
- 11 of those services throw `AppError` with an HTTP status code
  (`apps/api/src/errors/app-error.ts`), so application logic depends on the
  HTTP transport.
- The orchestration the demo would need (overview, scenario compare, decision
  replay, transaction creation through `UnitOfWork`) lives inside `apps/api`
  and is not reachable from a frontend build.

The domain package already provides what an injectable design needs:
repository contracts (`packages/domain/src/repositories/`), a `UnitOfWork`
contract, entities, validators and pure calculations.

## Decision

1. **Location.** Create `@trading/application` (`packages/application`). It
   depends only on `@trading/domain`. It must not import Prisma, Express,
   Zod transport schemas or any browser API. This boundary is enforced by
   lint rules.
2. **Style.** One factory per resource that receives its dependencies and
   returns the same functions the services expose today, for example
   `createPortfolioService({ portfolioRepository })`. No class-per-use-case
   or command bus. Functions keep their current responsibilities, but the
   caller identity changes from a bare `userId` to an `Actor` (ADR-005).
3. **Errors.** The application throws transport-free errors
   (`NotFoundError`, `ConflictError`, and similar) defined in the
   application package. Each delivery mechanism maps them: the API error
   handler to HTTP status codes, the demo to its own UI states. Domain
   validation errors keep their existing behavior.
4. **Composition root.** `apps/api/src/composition.ts` builds the Prisma
   repositories and `PrismaUnitOfWork` and injects them into the
   application factories. Routes and controllers receive the composed
   services. The demo has its own composition root with in-memory
   implementations of the same contracts.
5. **Validation split.** Request parsing and shape validation stay at the
   boundary (Zod; location defined by ADR-002). The application receives
   typed inputs. Domain invariants stay in domain validators.
6. **Read models.** Composite reads (overview, scenario calculate and
   compare, decision replay, analytics) belong to the application layer.
7. **Testing.** Application services are unit-tested with in-memory fake
   repositories. Existing HTTP integration tests in `apps/api` stay as they
   are and keep covering the Prisma path end to end.

## Consequences

**Positive**

- The demo reuses real orchestration instead of duplicating it, which is
  the core promise of `00-overview.md` and `12-demo-mode-spec.md`.
- Application logic becomes testable without a database.
- The in-memory fakes written for tests are the starting point for the
  demo's mock repositories.
- Infrastructure is wired in exactly one place per runtime.

**Negative**

- A refactor of every existing service before new backend work (block B0).
- Every repository contract must be implementable in memory, so contracts
  must document ordering and behavior precisely (for example the scenario
  list order already documented in its contract).
- `UnitOfWork` must also have an in-memory implementation with rollback.

## Alternatives Considered

- **Demo mocks at the HTTP client level, sharing only the domain.** Cheaper
  now, but every orchestration rule (overview composition, transaction
  atomicity, scenario comparison) would exist twice and drift. Rejected.
- **Use-case classes with `execute()` per operation.** Adds ceremony without
  a concrete benefit for this codebase, and deviates further from the
  existing function-based services. Rejected.
- **Keep services in `apps/api` and inject through function parameters.**
  Solves testability but not reuse: the frontend cannot depend on the API
  application. Rejected.

## Deferred detail

Implementation edge cases that do not change this decision. Each is
specified and tested in the listed block.

| Item | Resolution | Block |
|---|---|---|
| Lost update on the position read-modify-write: two concurrent `SELL`s of 6 on a holding of 10 both succeed at `READ COMMITTED`. | The `UnitOfWork` contract guarantees isolation for position updates: a row lock (`SELECT … FOR UPDATE`), a per-portfolio-and-asset advisory lock, or `SERIALIZABLE` with retry. A concurrent-`SELL` test covers it. | B0 |
| The in-memory `UnitOfWork` (demo) restores a snapshot on rollback, which can erase another unit's committed write when units interleave. | Serialize units with an async mutex, or roll back only the unit's own write log. | B0 |

## Related

- `06-architecture.md` (to be rewritten against this decision)
- `12-demo-mode-spec.md` §87-88
- ADR-002 (shared contracts and boundary validation)
