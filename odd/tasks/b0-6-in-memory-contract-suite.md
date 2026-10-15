# B0.6 In-memory repositories, UnitOfWork and shared contract suite

Source: roadmap B0 lines 150-151 and 190-194; deferred detail (in-memory UnitOfWork). Depends on: B0.5.
Branch: feat/b0-6-in-memory-repositories. Runner: vitest (`pnpm --filter <pkg> test`).

In-memory implementations live in a new package, `@trading/persistence-memory` (`packages/persistence-memory`), which depends only on `@trading/domain`. It serves the tests and the demo mode (docs/12-demo-mode-spec.md).

## Allowed edit surfaces

packages/persistence-memory/**
packages/database/src/**/\*.test.ts
packages/database/package.json
tsconfig.json
eslint.config.js
pnpm-lock.yaml
odd/tasks/b0-6-in-memory-contract-suite.md

## Tasks

- [x] T1 In-memory implementations of all repository contracts (portfolio, asset, prices, position, transaction, decision, decision event, scenario, notification, watchlist, alert, user preference, market event, user, credential). Commits 066971c to the user and credential repositories.
- [x] T2 In-memory `UnitOfWork`: `snapshot()`/`restore()` on the position and transaction repositories (T2a), and `InMemoryUnitOfWork` with a serial queue and rollback (T2b, interleaved units cannot erase each other's writes).
- [ ] T3 One repository contract suite run against Prisma and in-memory.
  - Design: the suite lives in `packages/persistence-memory/src/contract/`, exposed as the subpath `@trading/persistence-memory/contract`; it depends only on `vitest` and `@trading/domain`.
  - Each suite takes a factory `() => { repository, fixtures, cleanup }`. Prisma creates real user, portfolio and asset rows; in-memory returns any ids.
  - `database` adds `persistence-memory` as a devDependency and calls the suite from its existing tests. Prisma-only checks (foreign keys, cascades) stay in the Prisma test files.
  - Migrated one repository at a time, starting with portfolio (T3a).
  - T3a done: `portfolioRepositoryContract` (9 cases) runs against in-memory (`in-memory-portfolio-repository.contract.test.ts`) and Prisma (`prisma-portfolio-repository.test.ts`, two real users per test, cleanup by cascade). `updatedAt` is asserted with `>=` in the contract because a real clock can repeat a millisecond; the in-memory test with a fake clock keeps the strict `>`.
  - Wiring: `exports` subpath `./contract` in persistence-memory, ESLint exemption for `src/contract/**`, `database` devDependency plus tsconfig reference. Per-package `tsc --noEmit` needs a built `dist` of referenced projects; use the root `pnpm typecheck` (`tsc --build`).
  - Removed the flaky `src/index.test.ts` smoke test (timed out importing every repository under load).
  - T3b done: `assetRepositoryContract` (9 cases) runs against in-memory (`in-memory-asset-repository.contract.test.ts`) and Prisma (`prisma-asset-repository.test.ts`). The factory has no `fixtures` because assets have no foreign keys. Each test tags its symbols, names and exchange with a unique `CT-<uuid8>` value and scopes every `list` to it, so the suite also runs on a shared database. Prisma cleans up by `ASSET_CONTRACT_SYMBOL_PREFIX`, which also clears leftovers from a failed run. Duplicate symbol rejection is now covered on Prisma too.
  - Remaining: migrate the other 14 repositories one by one (suite file + in-memory runner + Prisma test rewrite), next is the simplest, then the ones with foreign-key fixtures (position, transaction, decision events). Keep Prisma-only checks (FK, cascades) in the Prisma files.

## Known differences from Prisma

In-memory repositories cannot check foreign keys across repositories (for example decision event to decision, credential to user).

## Known issues

`pnpm --filter @trading/database db:migrate` (`prisma migrate dev`) fails on migration `20261010120000_add_runtime_role`: it revokes on `_prisma_migrations`, which does not exist in the shadow database. Apply migrations with `db:test:migrate` (`migrate deploy`) instead. Not fixed in this feature.

## Done when

The contract suite passes against both implementations.

## Verification

pnpm --filter @trading/persistence-memory test; pnpm --filter @trading/database test.
