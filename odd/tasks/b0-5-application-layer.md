# B0.5 Application layer, Clock and composition root

Source: roadmap B0 lines 136-153 and 182-185; ADR-001; ADR-005 point 3. Depends on: B0.3, B0.4. Highest risk: one resource per commit; run the adversarial review here.

## Allowed edit surfaces

packages/application/**
apps/api/src/composition.ts
apps/api/src/services/**
apps/api/src/controllers/**
apps/api/src/routes/**
apps/api/src/middleware/**
eslint.config.*
tsconfig*.json
apps/api/package.json
docs/06-architecture.md

## Pre-flight decisions (2026-10-13)

- Package `@trading/application` depends only on `@trading/domain`. One factory per resource that receives its dependencies and returns the functions the service exposes today (ADR-001 point 2). No use-case classes.
- In scope: the 13 resource services. `auth.service` (B2) and `health.service` (infrastructure) stay where they are. In-memory repositories and `UnitOfWork` are B0.6. The archived-portfolio guard and transaction chronology are B0.7.
- `Actor { userId, role }`. `role` reuses the current domain `UserRole` as a placeholder; B2 migrates it (ADR-005 point 1). Permissions are `assertPermission(actor, permission)` over a typed `Permission` union. B0.5 ships a matrix in which every current role holds every permission, so behavior is unchanged; B2 fills it in. Ownership checks stay in the use cases (404 for foreign resources).
- `Clock { now(): Date }`, injected through the composition root. `validateNewTransaction(input, now)` takes the time as a required argument; its callers (contracts, database mapper, seed, tests) are updated. No defaulted `new Date()`.
- Application errors are transport-free classes: `NotFoundError`, `ConflictError`, `ForbiddenError`. Their names avoid the `Invalid*` and `Insufficient*` prefixes so `error-handler.ts` does not catch them by its name regex. The handler maps them to exactly today's `AppError` codes and status codes, because the B0.3 and B0.4 tests pin them.
- Composition root: `apps/api/src/composition.ts` exports the composed services. Controllers become `makeXController(services)` factories wired by the routers. The tests keep building the app through `createApp()`.
- ESLint: replace the commented placeholder at `eslint.config.js:~41-43` so `@trading/application` may import only `@trading/domain`. Proof: a throwaway fixture importing Prisma or Express fails lint, then is deleted.
- tsconfig: add `packages/application` (and the missing `packages/contracts`) to the root references and to `apps/api/tsconfig.json`.
- Risks: HTTP status codes and error bodies (pinned by route tests); import cycles between services (portfolio and asset are the shared dependencies, so they move first); `vi.mock` of services in `health.unavailable.routes.test.ts`; the `validateNewTransaction` signature (4 callers).

## Tasks

- [x] T1 Package scaffold (depends only on `@trading/domain`), application errors, `Actor`, permission mechanism, `Clock` port. Route: inline. Evidence: RED observed (modules missing), then GREEN; `pnpm --filter @trading/application test` 3 files, 12/12; `pnpm typecheck` clean; `pnpm exec eslint .` clean. New package `packages/application` (`errors.ts`, `clock.ts` with `fixedClock`, `actor.ts`, `permissions.ts`), root `tsconfig.json` now references `contracts` and `application`, `pnpm-lock.yaml` gains only the new workspace importer. `apps/api` does not depend on the package yet (T2). `systemClock` is wired in the composition root (T2), so this package never calls `new Date()`. Risk: item 5 (new workspace package and lockfile entry, no runtime consumer yet).
- [x] T2 Composition root and ESLint import-boundary rule (replace the commented placeholder). Route: inline. Evidence: RED observed (`composition.ts` missing), then GREEN, `composition.test.ts` 3/3. `apps/api/src/composition.ts` exports `systemClock`, `buildComposition(clock)` and `composition`; `apps/api` now depends on `@trading/application` (package.json, tsconfig reference, lockfile). The rule uses a `regex` in `no-restricted-imports` (`^(?!@trading/domain$|\.{1,2}/).+`) because gitignore-style negations in `group` also blocked `@trading/domain` and relative imports. Proof with a throwaway fixture in `packages/application/src` (deleted): `ab/evil`, `x/y`, `express` and `@prisma/client` fail; `@trading/domain`, `./clock.js` and `../src/errors.js` pass. The first regex, with an unescaped dot, let `ab/evil` and `x/y` through; the adversarial fixture caught it. Tests are exempt from the rule. `pnpm exec eslint .` and `pnpm typecheck` clean. Risk: item 5 (new dependency edge, lint config).
- [ ] T3 Move portfolios (factory, tests with fakes).
- [ ] T4 Move assets and market.
- [ ] T5 Move positions and transactions.
- [ ] T6 Move composite reads: overview, scenarios, decision replay, analytics.
- [ ] T7 Remove `new Date()` from domain and application code; fixed clock in tests. Reword the two stale async-creation comments.

## Done when

B0.3 and B0.4 tests pass unchanged; the lint rule fails on a Prisma or Express import inside `@trading/application`.

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/api test; pnpm lint; pnpm typecheck.
