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
- [x] T3 Move portfolios (factory, tests with fakes). Route: inline. Evidence: RED observed for the service (module missing), the error mapping and the actor (3 + 3 failing), then GREEN. `createPortfolioService({ portfolioRepository, permissions? })` in `packages/application/src/portfolio-service.ts`, 11 tests with a fake repository (owner scoping, anti-enumeration `NotFoundError`, domain validation before the repository, no write when foreign, idempotent archive, permission checks with a restricted matrix). `error-handler.ts` maps `NotFoundError` to 404 NOT_FOUND, `ConflictError` to 409 CONFLICT and `ForbiddenError` to 403 FORBIDDEN with the use case message. `authenticate` builds `req.actor` and rejects an unknown token role with the generic 401; `actorOf(req)` reads it. The portfolios controller is `makePortfoliosController(service)` and the router takes the service from `composition.portfolioService`. `services/portfolio.service.ts` is now a transitional adapter (`getPortfolioById(userId, id)` with a placeholder `USER` role) for the eight services that have not moved yet; it is deleted with the last of them. The B0.3 and B0.4 portfolio tests are unchanged. User ran the full `@trading/api` suite. Risk: item 3 (the error handler is shared by every route; the new branch only matches the three application error classes).
- [x] T4 Move assets and market. Route: inline. Evidence: RED observed (both service modules missing), then GREEN; `createAssetService({ assetRepository, permissions? })` (`asset:read`) and `createMarketService({ assetRepository, marketPriceRepository, historicalPriceRepository, permissions? })` (`market:read`) in `packages/application`, 12 new tests with fakes (35/35 in the package). Both take only the repository methods they use (`Pick<...>`). The two 404 messages are preserved ("The requested asset could not be found." and "No current price is available for this asset."), and the batch never 404s. `makeAssetsController(assetService, marketService)` and `makeMarketController(marketService)`; routers take the services from `composition`. `services/market.service.ts` is deleted. `services/asset.service.ts` is now a transitional adapter (`getAssetById`, `getAssetsByIds`) for alert, watchlist, analytics, overview and scenario, using `services/transitional-actor.ts`, which `portfolio.service.ts` shares. Both go with the last service that moves (T6). `pnpm typecheck` and `pnpm exec eslint .` clean. User ran the full `@trading/api` suite. Risk: item 3 (the asset adapter feeds five services that have not moved yet).
- [x] T5 Move positions and transactions. Route: inline. Evidence: commit cb0fd28; `PrismaUnitOfWork` injected through the composition root, use case tested with a fake. Risk: item 1 (transaction writes and position recalculation).
- [x] T6 Move composite reads (overview, scenarios, decision replay, analytics) plus decisions, notifications and watchlist. Route: inline. Evidence: commits c98bf9d, b58f357, 5c3eef4, 6d7c573, 81e9d3a.
- [x] T6b Move alerts and user preferences (the last two services). Route: inline. Evidence: RED observed (2 test files, service modules missing), then GREEN, application suite, typecheck, eslint and the API suite run by the user, all OK. `createAlertService` (`alert:read`/`alert:write`) and `createUserPreferenceService` (`preference:read`/`preference:write`); `makeAlertsController` and `makePreferencesController`; `composition` exposes `alertService` and `userPreferenceService`. Deleted `services/alert.service.ts`, `user-preference.service.ts`, `portfolio.service.ts`, `asset.service.ts` and `transitional-actor.ts`; `apps/api/src/services` keeps only `auth` and `health`, as decided. Risk: item 3 (the portfolio and asset adapters fed every dependant).
- [x] T7 `validateNewTransaction(input, now)` takes a required `now`; `createTransactionService` takes a `clock` dependency wired in the composition root; the seed passes its own `new Date()`. Domain tests use a fixed `now`; a new service test pins a future `executedAt` against the injected clock. Route: inline. Evidence: domain, application, typecheck, eslint and API suites run by the user, all OK. RED not observed for the domain change (implemented before its test was updated); the service test is the pin. Remaining `new Date()` calls live in `packages/database` (mapper defaults, seed) and the health controller, outside domain and application. The two async-creation comments were re-read and are accurate (the async job flow is Phase 10), so they were left as they are. Risk: item 3 (public domain signature, 3 callers).

## Done when

B0.3 and B0.4 tests pass unchanged; the lint rule fails on a Prisma or Express import inside `@trading/application`.

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/api test; pnpm lint; pnpm typecheck.

## Next steps (resume here)

All tasks are done. Left: commit T6b and T7 (the user may prefer one commit each), run the adversarial review against `develop` (this slice is flagged highest risk), update the gitignored `pr-body.md`, and the user opens the PR as one PR with `size:exception`.

Historical notes below, kept for the record:

- T5 DONE (committed; application tests, typecheck and lint green; API integration suite pending the user's run, RED not observed before implementation). Original note: positions and transactions. Highest risk: transactions use `PrismaUnitOfWork` (`transaction.service.ts:21-23`) and synchronous position recalculation; the in-memory `UnitOfWork` is B0.6, so T5 injects the Prisma one through the composition root and tests the use case with a fake. `position.service.ts` imports `./portfolio.service` without the `.js` extension.
- T6 composite reads (overview, scenarios, decision replay, analytics). When the last of them moves, delete `services/portfolio.service.ts`, `services/asset.service.ts` and `services/transitional-actor.ts`, and pass the real `Actor` through the dependants.
- T7 `validateNewTransaction(input, now)` with a required `now` (4 callers: contracts `transaction.schema.ts`, database `transaction-mapper.ts`, the seed step `seed-positions-and-transactions.ts`, domain `transaction.test.ts`), the `new Date()` in `notification.service.ts:40,52` and `overview.service.ts:128`, and the two stale async-creation comments (`transaction.service.ts:86-95`, `transactions.controller.ts:80-81`).
- Notifications, alerts, watchlist, user preferences, decisions and scenarios CRUD have no task yet in this list: the task file only names portfolios, assets and market, positions, transactions and the composite reads. Decide with the user whether they move in B0.5 or later before T6 ends.
- Run the adversarial review after the last task (this slice is flagged highest risk). Open the PR to `develop` as one PR with `size:exception` (`pr-body.md` is gitignored; the user pushes).
