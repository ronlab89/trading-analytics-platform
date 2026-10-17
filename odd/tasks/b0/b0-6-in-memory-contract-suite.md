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
odd/tasks/b0/b0-6-in-memory-contract-suite.md

## Tasks

- [x] T1 In-memory implementations of all repository contracts (portfolio, asset, prices, position, transaction, decision, decision event, scenario, notification, watchlist, alert, user preference, market event, user, credential). Commits 066971c to the user and credential repositories.
- [x] T2 In-memory `UnitOfWork`: `snapshot()`/`restore()` on the position and transaction repositories (T2a), and `InMemoryUnitOfWork` with a serial queue and rollback (T2b, interleaved units cannot erase each other's writes).
- [x] T3 One repository contract suite run against Prisma and in-memory.
  - Design: the suite lives in `packages/persistence-memory/src/contract/`, exposed as the subpath `@trading/persistence-memory/contract`; it depends only on `vitest` and `@trading/domain`.
  - Each suite takes a factory `() => { repository, fixtures, cleanup }`. Prisma creates real user, portfolio and asset rows; in-memory returns any ids.
  - `database` adds `persistence-memory` as a devDependency and calls the suite from its existing tests. Prisma-only checks (foreign keys, cascades) stay in the Prisma test files.
  - Migrated one repository at a time, starting with portfolio (T3a).
  - T3a done: `portfolioRepositoryContract` (9 cases) runs against in-memory (`in-memory-portfolio-repository.contract.test.ts`) and Prisma (`prisma-portfolio-repository.test.ts`, two real users per test, cleanup by cascade). `updatedAt` is asserted with `>=` in the contract because a real clock can repeat a millisecond; the in-memory test with a fake clock keeps the strict `>`.
  - Wiring: `exports` subpath `./contract` in persistence-memory, ESLint exemption for `src/contract/**`, `database` devDependency plus tsconfig reference. Per-package `tsc --noEmit` needs a built `dist` of referenced projects; use the root `pnpm typecheck` (`tsc --build`).
  - Removed the flaky `src/index.test.ts` smoke test (timed out importing every repository under load).
  - T3b done: `assetRepositoryContract` (9 cases) runs against in-memory (`in-memory-asset-repository.contract.test.ts`) and Prisma (`prisma-asset-repository.test.ts`). The factory has no `fixtures` because assets have no foreign keys. Each test tags its symbols, names and exchange with a unique `CT-<uuid8>` value and scopes every `list` to it, so the suite also runs on a shared database. Prisma cleans up by `ASSET_CONTRACT_SYMBOL_PREFIX`, which also clears leftovers from a failed run. Duplicate symbol rejection is now covered on Prisma too.
  - T3c done: `userRepositoryContract` (7 cases) runs against in-memory (`in-memory-user-repository.contract.test.ts`) and Prisma (`prisma-user-repository.test.ts`). No `fixtures`: users are the root of the schema. Each user gets a unique `ct-user-<uuid>@example.com` email and Prisma cleans up by `USER_CONTRACT_EMAIL_PREFIX`. `list` is checked for containment only, because it returns every user of the storage; insertion order and case-sensitive email lookup stay in the in-memory test. Duplicate email rejection is now covered on Prisma too.
  - T3d done: `userPreferenceRepositoryContract` (8 cases) runs against in-memory (`in-memory-user-preference-repository.contract.test.ts`) and Prisma (`prisma-user-preference-repository.test.ts`). Fixtures are two users, as in portfolio; Prisma deletes them and the cascade removes the preferences. `defaultPortfolioId` is a plain string column, not a foreign key, so the suite uses a made-up id. The strict `updatedAt` ordering with a fake clock stays in the in-memory test.
  - T3e done: `notificationRepositoryContract` (9 cases) runs against in-memory and Prisma. Fixtures are two users; the cascade removes the notifications. Listing is only checked to be newest first by `createdAt`, because Prisma orders by `createdAt desc` with no tie-break; the same-instant ordering stays in the in-memory test.
  - T3f done: `credentialRepositoryContract` (6 cases) runs against in-memory and Prisma. Fixtures are two users; the cascade removes the credential. The update-without-credential case uses the second user, who exists but has no credential. The foreign key to user stays a Prisma-only concern.
  - T3g done: `marketEventRepositoryContract` (5 cases) runs against in-memory and Prisma. Fixtures are two assets; the cascade removes the events. The suite never creates two events with the same (asset, sequence), since the schema does not forbid it. The exact timestamp (fake clock) stays in the in-memory test.
  - T3h done: `marketPriceRepositoryContract` (5 cases) runs against in-memory and Prisma. Fixtures are two assets; the cascade removes the prices. Amounts have no trailing zeros so they read back identical from `Decimal(18,8)`. The old Prisma check that counted rows with `prisma.marketPrice.findMany` is now `listByAssetIds([assetId])` with length 1.
  - T3i done: `historicalPriceRepositoryContract` (5 cases) runs against in-memory and Prisma. Fixtures are two assets; the cascade removes the candles. A candle is keyed by (asset, timestamp), so replaying one overwrites it; an omitted timestamp is checked against a before/after window of the real clock. The old Prisma check that counted rows with `prisma.historicalPrice.findMany` is now the listing in the replay case. The fake-clock default stays in the in-memory test.
  - T3j done: `watchlistItemRepositoryContract` (6 cases) runs against in-memory and Prisma. Fixtures are two users and two assets; the cascade removes the items. Duplicate rejection checks the domain `InvalidWatchlistItemError`, which Prisma raises by translating `P2002`. Listing is compared as a set because Prisma has no `orderBy`; insertion order and the fake-clock `createdAt` stay in the in-memory test.
  - T3k done: `alertRepositoryContract` (7 cases) runs against in-memory and Prisma. Fixtures are two users, one asset and one portfolio (owned by the first user); deleting the users cascades to the portfolio and the alerts, and the asset is deleted on its own. Listing is compared as a set because Prisma has no `orderBy`; insertion order and the strict fake-clock `updatedAt` stay in the in-memory test. The explicit asset and portfolio and the nonexistent update/delete cases are now covered on Prisma too.
  - T3l done: `scenarioRepositoryContract` (9 cases) runs against in-memory and Prisma. Fixtures are two portfolios of one user; deleting the user cascades to the portfolios and the scenarios. Listing is compared as a set, newest first by `createdAt`, because Prisma breaks ties by `id asc` (cuid) while in-memory uses creation order; the in-memory tie-break stays in its own test. Three Prisma-only checks stay in `prisma-scenario-repository.test.ts` because they write rows straight into the table: malformed stored changes, a non-array changes value, and newest-first with an explicit `createdAt`. `baseSnapshotId` and the `assetId` inside `changes` are not foreign keys, so the suite uses made-up ids.
  - T3m done: `decisionRepositoryContract` (11 cases) runs against in-memory and Prisma. Fixtures are one user with two portfolios, and two assets. Teardown deletes the user first (the cascade removes portfolios and decisions) and the assets afterwards, because a decision restricts the deletion of its asset (`onDelete: Restrict`). The ordering and filter cases give every decision a different `createdAt`, so the expected order is exact in both storages; the same-instant tie-break stays in the in-memory test. The three prices share one `currency` column; clearing one with `null` is now covered on Prisma too.
  - T3n done: `decisionEventRepositoryContract` (4 cases) runs against in-memory and Prisma. Fixtures are two decisions of one portfolio; teardown deletes the user first (the cascade removes the portfolio, decisions and events) and the asset afterwards, because of the `Restrict` on decisions. Every listed event has a different timestamp, so the expected order is exact in both storages; the same-instant tie-break stays in the in-memory test. The foreign key from event to decision stays a Prisma-only concern.
  - T3o done: `positionRepositoryContract` (7 cases) runs against in-memory and Prisma. Fixtures are one user with two portfolios, and two assets; teardown deletes the user first (the cascade removes portfolios and positions) and the assets afterwards, because of the `Restrict` on positions. Listing is compared as a set because Prisma has no `orderBy`. The suite does not assert `openedAt == updatedAt` on a new position: Prisma sets them with two separate clock reads, so that equality, the strict fake-clock `updatedAt`, and `snapshot`/`restore` stay in the in-memory tests.
  - T3p done: `transactionRepositoryContract` (9 cases) runs against in-memory and Prisma. Fixtures are one user with two portfolios, and two assets; teardown deletes the user first (the cascade removes portfolios and transactions) and the assets afterwards, because of the `Restrict` on transactions. Every transaction in the ordering, filter and pagination cases has a different `executedAt`, so the expected order is exact in both storages; the same-instant tie-break and `snapshot`/`restore` stay in the in-memory tests. `createdAt` is only checked to be a date, because Prisma takes it from the database clock. The decimal-precision round trip of price, fees and quantity is now part of the contract.
  - Remaining: none. All 16 repositories run the shared contract suite against in-memory and Prisma.

## Known differences from Prisma

In-memory repositories cannot check foreign keys across repositories (for example decision event to decision, credential to user).

## Known issues

`pnpm --filter @trading/database db:migrate` (`prisma migrate dev`) fails on migration `20261010120000_add_runtime_role`: it revokes on `_prisma_migrations`, which does not exist in the shadow database. Apply migrations with `db:test:migrate` (`migrate deploy`) instead. Not fixed in this feature.

## Done when

The contract suite passes against both implementations.

## Verification

pnpm --filter @trading/persistence-memory test; pnpm --filter @trading/database test.
