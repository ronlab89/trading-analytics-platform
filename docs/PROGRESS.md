# PROGRESS.md

**Project:** Trading Analytics Platform
**Last updated:** End of Phase 2 Step 5 (all 15 repository implementations complete) — cutover to new chat to continue with Step 6 (seed workflow)
**Current branch context:** `feat/database-infrastructure` (created from `develop` after Phase 1 merge — verify with `git status`/`git log` at the start of next session before trusting this claim, per the lesson learned in Phase 1 and reinforced in Phase 2)

> This file is the source of truth for resuming work across chat sessions.
> Do not rely on assistant memory — read this file first, then the relevant
> SDD documents in `docs/`, then `CONTRIBUTING.md` for workflow rules.
>
> **Filesystem MCP access confirmed working** for this project throughout
> this entire session (root: `Internal Projects/trading-analytics-platform`).
> Every repository contract and entity was read directly via this MCP
> immediately before implementing its corresponding mapper/repository —
> this caught multiple real schema/domain mismatches this session (see §5).
> Continue this practice without exception.

---

## 1. Current Phase / Step

**Phase 0 — Repository Foundation:** ✅ COMPLETE (merged to `develop`)

**Phase 1 — Product and Domain Foundation:** ✅ COMPLETE (merged to `develop`)

**Phase 2 — Database and Infrastructure:** 🔄 IN PROGRESS

Sub-steps closed this phase so far:

- [x] Step 1 — PostgreSQL via Docker Compose (Postgres 18, pinned explicitly)
- [x] Step 2 — `packages/database` package scaffolded; Prisma installed; initial schema slice (`User`, `Portfolio`, `Asset`)
- [x] Step 3a — `Transaction`, `Position` models added (Decimal(18,8) monetary precision pattern)
- [x] Step 3b — Remaining 10 entities added to schema — 15 domain tables confirmed in Postgres
- [x] Step 4 — Repository **contracts** (interfaces only) for all 15 entities in `packages/domain/src/repositories/`
- [x] **Step 5 — Real (Prisma-backed) implementations of all 15 repository contracts — COMPLETE THIS SESSION**

**Not yet started (remaining Phase 2 scope per `15-implementation-plan.md` §7):**

- [ ] Step 6 — Seed workflow (coherent demo/dev dataset per `05-data-model.md` §33-37)
- [ ] Step 7 — Local reset workflow (documented, not just ad-hoc `docker compose down -v`)

---

## 2. Next Phase / Step

**Immediate next step:** Phase 2, Step 6 — design and implement the seed workflow.

Recommended approach (to confirm with the user at the start of next session, not assumed here): a dedicated `packages/database/prisma/seed.ts` (or `packages/database/src/seed/` module) that uses the now-complete repository implementations — **not raw Prisma calls** — to build the coherent baseline dataset described in `05-data-model.md` §33-37 and `12-demo-mode-spec.md` §13 (1 demo user, 2+ portfolios, positions with mixed profitability, transactions of multiple types, alerts in varied states, historical price data, at least one intentionally empty portfolio for empty-state testing).

**Key design questions to resolve before Step 6 starts** (not decided yet):
1. Does the seed script go through the repository layer (`PrismaPortfolioRepository`, etc. — exercises the same code path as the real app) or talk to Prisma directly for speed/simplicity? Leaning toward "through the repositories" for consistency with the architecture's own principles (`06-architecture.md` §12-13), but this trades off some seed-script simplicity and needs to be discussed.
2. Where does the deterministic seed value (`DEMO_SEED`, `05-data-model.md` §16) actually get consumed in Step 6 — is randomness needed at all for the *database* seed (vs. the browser-only Demo Mode simulation engine, which is a separate, later concern per `12-demo-mode-spec.md`)? This needs clarifying before writing any data-generation code, since "seed" means two different things in this project's vocabulary (Prisma DB seed vs. Demo Mode deterministic simulation seed) and conflating them would be a real design mistake.
3. Should the seed script be idempotent (safe to re-run without duplicating data), and if so, via what mechanism (delete-all-then-insert vs. upsert-by-natural-key)?

### Context length note

This session (Step 5) was the longest single step in the project so far, as anticipated in the previous PROGRESS.md handoff — it took the full session and included three real schema corrections mid-flight. Step 6 is expected to be smaller (one seed script, not 15 repository implementations), but still worth watching context length proactively given how much back-and-forth debugging (`exactOptionalPropertyTypes`, ESLint project graph, stale `.tsbuildinfo`) this session needed.

---

## 3. What's Been Implemented

### 3.1 `packages/database/src/` (new this session — did not exist at the start of this session)

```text
packages/database/
├── src/
│   ├── client.ts                                    (PrismaClient singleton, dev hot-reload guard)
│   ├── index.ts                                      (public barrel — see §3.3)
│   ├── mappers/                                       (15 files, one per entity — see §3.2)
│   └── repositories/                                   (15 implementation files + 15 *.test.ts — see §3.2)
├── tsconfig.json                                      (new this session)
├── vitest.config.ts                                   (new this session)
├── package.json                                       (updated: typescript, vitest, @types/node, @trading/domain deps; main/types now point to src/index.ts)
├── prisma/
│   ├── schema.prisma                                  (updated — see §3.4 for the 3 schema corrections made this session)
│   └── migrations/
│       └── ... (2 new migrations this session — see §3.4)
└── generated/client/                                   (Prisma Client output — gitignored, generated via `pnpm db:generate`)
```

### 3.2 The 15 repository implementations (all complete, all with integration tests passing against real Docker Postgres)

| Entity | Mapper | Repository | Notable characteristics |
|---|---|---|---|
| Portfolio | `portfolio-mapper.ts` | `prisma-portfolio-repository.ts` | First implemented — validated the mapper+repo+test pattern |
| User | `user-mapper.ts` | `prisma-user-repository.ts` | No `delete()` — matches contract |
| Asset | `asset-mapper.ts` | `prisma-asset-repository.ts` | `Json` metadata; no `delete()` (onDelete: Restrict from Transaction/Position) |
| Transaction | `transaction-mapper.ts` | `prisma-transaction-repository.ts` | Money/Decimal round-trip via string; `executedAt` defaults to `new Date()` when omitted (confirmed decision); no generic `update()` (historical fact, only `updateStatus()`) |
| Position | `position-mapper.ts` | `prisma-position-repository.ts` | **Schema correction**: added `currency` column (see §3.4); `upsert()` split into separate create/update payloads to avoid resetting `openedAt` on every update (real bug caught before shipping) |
| Decision | `decision-mapper.ts` | `prisma-decision-repository.ts` | Three independently-nullable Money fields sharing one nullable `currency` column; `exactOptionalPropertyTypes` required extracting `.toString()` calls to local consts before conditional spread (TS narrowing limitation — see §5) |
| DecisionEvent | `decision-event-mapper.ts` | `prisma-decision-event-repository.ts` | Append-only, no `update()`/`delete()`; `payload` defaults to `{}` when omitted (confirmed decision); `timestamp` always repository-assigned |
| Scenario | `scenario-mapper.ts` | `prisma-scenario-repository.ts` | `changes` Json column intentionally NOT read into the domain entity (matches domain's own shape decision); `updateChanges()` persists but never returns `changes` |
| WatchlistItem | `watchlist-item-mapper.ts` | `prisma-watchlist-item-repository.ts` | `create()` translates Prisma's `P2002` unique-constraint violation into the domain's `InvalidWatchlistItemError` |
| Alert | `alert-mapper.ts` | `prisma-alert-repository.ts` | No Money at all — `threshold` is a bare `Float` per schema |
| Notification | `notification-mapper.ts` | `prisma-notification-repository.ts` | **Confirmed decision**: `metadata` is `Json?` (nullable) in schema vs. non-nullable in domain — resolved entirely in the mapper (`null` → `{}` on read, never written as `null`), no migration |
| UserPreference | `user-preference-mapper.ts` | `prisma-user-preference-repository.ts` | Keyed by `userId`, not `id`; `notificationPreferences` Json cast on both create and update |
| MarketPrice | `market-price-mapper.ts` | `prisma-market-price-repository.ts` | **Schema correction**: added `currency` column (see §3.4); single-record-per-asset `upsert()`, no split needed (no `openedAt`-style field) |
| MarketEvent | `market-event-mapper.ts` | `prisma-market-event-repository.ts` | Append-only; `sequence` converted `BigInt` ↔ `number` (documented, accepted precision trade-off for realistic tick-counter ranges) |
| HistoricalPrice | `historical-price-mapper.ts` | `prisma-historical-price-repository.ts` | **Schema correction**: added `currency` column (see §3.4); composite PK `(assetId, timestamp)`; `create()` implemented via Prisma `upsert()` internally to satisfy the contract's documented idempotent-replay requirement without changing the method's public name; `timestamp` defaults to `new Date()` when omitted |

### 3.3 `packages/database/src/index.ts` — public barrel

Exports exactly two categories, by explicit decision this session (see §4):
- `prisma` (the shared client singleton — useful for future seed scripts / test cleanup)
- All 15 `Prisma*Repository` classes

Mappers are **not** exported — internal implementation detail of each repository, never part of the public contract.

### 3.4 Schema corrections made this session (in addition to Phase 2's earlier corrections already logged)

| Correction | Migration | Reason |
|---|---|---|
| Added `currency String` to `Position` | `20260913144307_add_currency_to_position` | Domain requires `averageEntryPrice`/`currentPrice` as `Money` sharing one currency; original schema had no column for it at all (not a nullability mismatch like the Notification one below — a genuinely missing column) |
| Added `currency String` to `MarketPrice` and `HistoricalPrice` | `20260913192914_add_currency_to_market_price_and_historical_price` | Same category of gap as Position, found while implementing `MarketPriceRepository`/`HistoricalPriceRepository` — `price`/`previousPrice`/`change` (MarketPrice) and `open`/`high`/`low`/`close` (HistoricalPrice) all needed a shared currency column that didn't exist |

Both corrections followed the same pattern already established in Phase 2: found by reading the domain entity and schema side-by-side before writing the mapper, flagged explicitly to the user with options, confirmed before touching `schema.prisma`.

---

## 4. Key Decisions Made This Session

| Decision | Reason |
|---|---|
| **Prisma↔domain mapping lives in a dedicated `packages/database/src/mappers/` module**, not inline in each repository | Resolved the one open item (§8.1) carried over from the previous session's handoff. Reduces duplication (the same Decimal→Money conversion pattern repeats across ~8 repositories), keeps repositories thin, keeps the conversion logic independently readable/testable. |
| **One barrel (`index.ts`) per workspace package, no barrels inside `src/repositories/` or `src/mappers/`** | Explicit discussion with the user about barrel-file risk (circular dependencies, tree-shaking). Distinguished "public package entrypoint" (low risk, single-level, matches the existing `@trading/domain` pattern) from "internal folder-by-folder barrels" (the genuinely risky pattern) — only the former is used here. |
| **Package entrypoint (`main`/`types`) points to `./src/index.ts`, not the raw generated Prisma client** | Corrected mid-session: the original Step 2 decision (before this package had any code) pointed `main`/`types` at `./generated/client/index.js`. Once a real public barrel existed, that config would have made `@trading/database`'s default import resolve to the raw Prisma client instead of our repositories — fixed to match `@trading/domain`'s own `main: "./src/index.ts"` pattern. |
| **`Transaction.executedAt` defaults to `new Date()` in the repository when omitted** | Confirmed with the user. The domain contract allows omitting it; the DB column has no default. Infrastructure fills the gap the domain contract left open. |
| **`DecisionEvent.payload` defaults to `{}` in the repository when omitted** | Confirmed with the user, after discussing why this is a structural fallback only (not a substitute for future per-event-type payload validation, which belongs in `validateNewDecisionEvent` if ever needed). |
| **`Notification.metadata` nullable/non-nullable mismatch resolved entirely in the mapper (`null` ↔ `{}`), no migration** | Confirmed with the user — the schema's nullable `Json?` is a superset of the domain's non-nullable requirement, so no schema change was needed, unlike the Position/MarketPrice/HistoricalPrice cases where the column was missing outright. |
| **`Position.upsert()` (and by extension, any future upsert with an "only set once" field) splits `create` and `update` payloads instead of sharing one object** | Real bug caught during Position implementation: a shared payload would have reset `openedAt` to "now" on every subsequent upsert, corrupting "when was this position first opened." |
| **`WatchlistItem.create()` relies on the DB's own `@@unique([userId, assetId])` constraint** (catches Prisma's `P2002`) rather than a pre-check `findFirst` + `create` | Avoids a race condition between the check and the insert; translates the low-level Prisma error into the domain's existing `InvalidWatchlistItemError` rather than inventing a new error type or leaking the raw Prisma error. |
| **`HistoricalPriceRepository.create()` uses Prisma's `upsert()` internally**, keeping the public method named `create()` | The domain contract's own module comment requires that "replaying the same candle does not create a duplicate row." Implemented as an internal implementation detail — the public API surface still matches the domain contract exactly. |
| **`MarketEvent.sequence`: `BigInt` (schema) ↔ `number` (domain) conversion accepted as a documented trade-off**, not "fixed" by changing either side | The domain's own validation only requires a non-negative integer; realistic per-asset tick counters will never approach `Number.MAX_SAFE_INTEGER`. Changing the domain to use `bigint` throughout was considered and rejected as unnecessary complexity for this project's actual scale (`03-non-functional-requirements.md`, Avoid Artificial Complexity). |

---

## 5. Corrections / Bugs Caught This Session (read before trusting anything as "already correct")

Continuing the practice from Phase 1 and earlier in Phase 2 — several real issues were only caught by reading actual files via filesystem MCP or by hitting real tool output, not by assumption:

1. **`packages/database/package.json` had no TypeScript/Vitest/`@trading/domain` dependency, and no `tsconfig.json`/`src/` existed at all** at the start of this session — Step 5 necessarily started with package setup (Step 5.1), not directly with repository code.
2. **`packages/database/package.json`'s `main`/`types` pointed to a Prisma output path that didn't exist yet** (`schema.prisma`'s generator had no `output` configured) — caught before running `db:generate` for the first time; resolved by adding `output = "../generated/client"` and choosing that path deliberately (Option A) over relying on Prisma's default `node_modules` resolution.
3. **Root `tsconfig.json`'s `references` array only listed `packages/domain`**, silently excluding `packages/database` from both the TypeScript build graph and, more importantly, from ESLint's `projectService`-based type-aware linting — this caused `packages/database/src/client.ts` and the Decision/Scenario mappers to be linted under a degraded "default project" fallback where real types (`@types/node`'s `process.env`, Prisma's generated enums) resolved as effectively `any`, producing misleading lint errors that had nothing to do with the actual code. Fixed by adding the missing reference.
4. **`eslint.config.js`'s ignore list didn't exclude `packages/database/generated/`** — ESLint was attempting to type-check Prisma's own generated output files, which aren't part of any tsconfig's `include`, producing dozens of unrelated parsing errors that had to be triaged away from the real issues first.
5. **`exactOptionalPropertyTypes: true` (already active in `tsconfig.base.json`) surfaced a real, repeated authoring mistake**: writing `field: input.field?.toString()` directly into a return object literal produces a property that is *present* with a possibly-`undefined` value, which this strict flag correctly rejects — the fix (conditional spread, `...(x !== undefined ? { field: y } : {})`) had to be applied consistently across `decision-mapper.ts`'s and `scenario-mapper.ts`'s `toPrismaCreateInput` functions. A second, more subtle variant of the same root cause was found in `decision-mapper.ts`: TS's control-flow narrowing did not reliably propagate through a *repeated* `input.entryPrice?.toString()` call inside an already-narrowed ternary branch — fixed by extracting the value to a local `const` first and narrowing on that instead, which is the reliable form of this pattern going forward.
6. **`decision-event-mapper.ts`'s `payload` write was missing the `as Prisma.InputJsonValue` cast** that `asset-mapper.ts` already used correctly for `metadata` — an inconsistency between two mappers doing conceptually the same Json-write operation, caught by the actual `tsc` error rather than by review.
7. **A stale `tsconfig.tsbuildinfo`** was suspected (and ruled out, not confirmed) as a possible cause of a persisting error during the Decision/Scenario mapper fix — deleting it and rebuilding was used as a diagnostic step; the real cause turned out to be item 5's narrowing issue, not caching. Documented here so a future session doesn't waste time re-suspecting the cache first without ruling out an actual code issue via the full error text.
8. **All 15 integration test files failed simultaneously with "60 skipped" the first time the full test command was run this session** — root cause was Docker's Postgres container not running at that moment (an environment/session-state issue, not a code issue). Confirmed via `docker compose ps` before spending time on more complex hypotheses (connection pool exhaustion, cross-file Prisma singleton contamination) that were raised as possibilities but not needed.

**Lesson reinforced (again):** every domain entity + repository contract was read directly via filesystem MCP immediately before writing its mapper, for all 15 entities across this entire session — this caught 3 genuine schema/domain mismatches (Position, MarketPrice, HistoricalPrice missing `currency`) before they became runtime bugs. Continue this without exception for Step 6 and beyond.

---

## 6. How to Resume From Here (Phase 2 Step 6 kickoff)

1. Read this file in full.
2. Use the filesystem MCP to independently verify current repo state — confirm `packages/database/src/repositories/` has 15 implementation files + 15 `*.test.ts` files (30 total), confirm `packages/database/src/mappers/` has 15 files, confirm `packages/database/src/index.ts` exports `prisma` + all 15 `Prisma*Repository` classes, confirm `packages/database/prisma/schema.prisma` has `currency` columns on `Position`, `MarketPrice`, and `HistoricalPrice` (§3.4).
3. Confirm local repo state: `git status`, `git branch --show-current`, `git log --oneline -20`.
4. Confirm Docker Postgres is running before doing anything that touches the database: `docker compose ps` (this bit the team once already this session — see §5, item 8).
5. Discuss and resolve the three open questions in §2 before writing any seed code — especially the "seed" naming ambiguity (Prisma DB seed vs. Demo Mode simulation seed), which is genuinely confusing terminology carried over from the SDDs themselves and worth clarifying explicitly with the user before it causes a real mistake.
6. Re-read `05-data-model.md` §33-37 (Demo Data Strategy) and `12-demo-mode-spec.md` §13 (Initial Dataset) together once more before starting — Step 6's seed script is what those sections describe as "Layer 1 — Seed Data."
7. Propose Phase 2 Step 6 as small, approvable sub-steps (e.g., 6.1 — seed script scaffolding and the design questions above; 6.2 — users/portfolios/assets; 6.3 — positions/transactions with realistic variation; 6.4 — decisions/scenarios/alerts/notifications; 6.5 — historical price data; 6.6 — wiring into an npm script + verification), rather than attempting the whole seed dataset in one shot.

---

## 7. Last Relevant Commits (this session, chronological)

```
chore(database): prepare package for typescript source and prisma client generation
chore(config): register @trading/database in root tsconfig project references
chore(lint): exclude generated prisma client output from eslint
feat(database): add prisma client singleton
feat(database): add portfolio mapper between prisma model and domain entity
feat(database): implement PrismaPortfolioRepository
feat(database): add public barrel exporting prisma client and repositories
fix(database): point package entrypoint to src barrel instead of generated client
test(database): add integration test for PrismaPortfolioRepository crud cycle
chore(database): load env vars in test scripts via dotenv-cli
feat(database): implement PrismaUserRepository with mapper, barrel export and integration tests
feat(database): implement PrismaAssetRepository with mapper, barrel export and integration tests
feat(database): implement PrismaTransactionRepository with money/decimal mapping, status lifecycle and integration tests
fix(database): implement PrismaPositionRepository, preserving openedAt across upserts
feat(database): implement Decision, DecisionEvent and Scenario repositories with mappers and integration tests
feat(database): implement WatchlistItem, Alert, Notification and UserPreference repositories with mappers and integration tests
feat(database): implement MarketPrice, MarketEvent and HistoricalPrice repositories, completing all 15 repository implementations
```

Exact order/squashing at merge time is a decision for the next PR review, not fixed here.

---

## 8. Open Items / Pending Decisions

- **8.1 — Prisma↔domain mapping location** — ✅ RESOLVED this session (dedicated `mappers/` module, confirmed with user).
- **8.2 — Prisma major version** — still deferred (release candidate, not stable per `04-tech-stack.md` §2). Not revisited this session; still on `6.19.3`. Revisit only once Prisma 8 reaches a real stable release, as its own isolated decision/PR.
- **8.3 — Seed workflow design** (Phase 2 Step 6, not started) — see §2 for the three specific open design questions that must be resolved before writing code, not just "not yet scoped" as the previous handoff said — now more concretely blocked on those three questions.
- **8.4 — Local reset workflow** (Phase 2 Step 7, not started) — still only ad-hoc `docker compose down -v` used/verified; a documented, repeatable command/script per `14-deployment-spec.md` §21 has not been created.
- **8.5 (carried over, still open, still non-blocking) — Branch-source enforcement for `main`** — deferred since Phase 0.
- **8.6 (carried over, still open, still non-blocking) — GitHub default branch still `main`** — deferred since Phase 0.
- **8.7 (new, non-blocking) — `packages/database`'s `typescript` devDependency (`^5.7.3`) is behind the root `package.json`'s `^6.0.3`** — noticed during Step 5.1, not fixed (out of scope for that sub-step, no functional impact observed). Worth a deliberate, isolated version-alignment pass at some point, not bundled into feature work.# PROGRESS.md

**Project:** Trading Analytics Platform
**Last updated:** End of Phase 2 Step 5 (all 15 repository implementations complete) — cutover to new chat to continue with Step 6 (seed workflow)
**Current branch context:** `feat/database-infrastructure` (created from `develop` after Phase 1 merge — verify with `git status`/`git log` at the start of next session before trusting this claim, per the lesson learned in Phase 1 and reinforced in Phase 2)

> This file is the source of truth for resuming work across chat sessions.
> Do not rely on assistant memory — read this file first, then the relevant
> SDD documents in `docs/`, then `CONTRIBUTING.md` for workflow rules.
>
> **Filesystem MCP access confirmed working** for this project throughout
> this entire session (root: `Internal Projects/trading-analytics-platform`).
> Every repository contract and entity was read directly via this MCP
> immediately before implementing its corresponding mapper/repository —
> this caught multiple real schema/domain mismatches this session (see §5).
> Continue this practice without exception.

---

## 1. Current Phase / Step

**Phase 0 — Repository Foundation:** ✅ COMPLETE (merged to `develop`)

**Phase 1 — Product and Domain Foundation:** ✅ COMPLETE (merged to `develop`)

**Phase 2 — Database and Infrastructure:** 🔄 IN PROGRESS

Sub-steps closed this phase so far:

- [x] Step 1 — PostgreSQL via Docker Compose (Postgres 18, pinned explicitly)
- [x] Step 2 — `packages/database` package scaffolded; Prisma installed; initial schema slice (`User`, `Portfolio`, `Asset`)
- [x] Step 3a — `Transaction`, `Position` models added (Decimal(18,8) monetary precision pattern)
- [x] Step 3b — Remaining 10 entities added to schema — 15 domain tables confirmed in Postgres
- [x] Step 4 — Repository **contracts** (interfaces only) for all 15 entities in `packages/domain/src/repositories/`
- [x] **Step 5 — Real (Prisma-backed) implementations of all 15 repository contracts — COMPLETE THIS SESSION**

**Not yet started (remaining Phase 2 scope per `15-implementation-plan.md` §7):**

- [ ] Step 6 — Seed workflow (coherent demo/dev dataset per `05-data-model.md` §33-37)
- [ ] Step 7 — Local reset workflow (documented, not just ad-hoc `docker compose down -v`)

---

## 2. Next Phase / Step

**Immediate next step:** Phase 2, Step 6 — design and implement the seed workflow.

Recommended approach (to confirm with the user at the start of next session, not assumed here): a dedicated `packages/database/prisma/seed.ts` (or `packages/database/src/seed/` module) that uses the now-complete repository implementations — **not raw Prisma calls** — to build the coherent baseline dataset described in `05-data-model.md` §33-37 and `12-demo-mode-spec.md` §13 (1 demo user, 2+ portfolios, positions with mixed profitability, transactions of multiple types, alerts in varied states, historical price data, at least one intentionally empty portfolio for empty-state testing).

**Key design questions to resolve before Step 6 starts** (not decided yet):
1. Does the seed script go through the repository layer (`PrismaPortfolioRepository`, etc. — exercises the same code path as the real app) or talk to Prisma directly for speed/simplicity? Leaning toward "through the repositories" for consistency with the architecture's own principles (`06-architecture.md` §12-13), but this trades off some seed-script simplicity and needs to be discussed.
2. Where does the deterministic seed value (`DEMO_SEED`, `05-data-model.md` §16) actually get consumed in Step 6 — is randomness needed at all for the *database* seed (vs. the browser-only Demo Mode simulation engine, which is a separate, later concern per `12-demo-mode-spec.md`)? This needs clarifying before writing any data-generation code, since "seed" means two different things in this project's vocabulary (Prisma DB seed vs. Demo Mode deterministic simulation seed) and conflating them would be a real design mistake.
3. Should the seed script be idempotent (safe to re-run without duplicating data), and if so, via what mechanism (delete-all-then-insert vs. upsert-by-natural-key)?

### Context length note

This session (Step 5) was the longest single step in the project so far, as anticipated in the previous PROGRESS.md handoff — it took the full session and included three real schema corrections mid-flight. Step 6 is expected to be smaller (one seed script, not 15 repository implementations), but still worth watching context length proactively given how much back-and-forth debugging (`exactOptionalPropertyTypes`, ESLint project graph, stale `.tsbuildinfo`) this session needed.

---

## 3. What's Been Implemented

### 3.1 `packages/database/src/` (new this session — did not exist at the start of this session)

```text
packages/database/
├── src/
│   ├── client.ts                                    (PrismaClient singleton, dev hot-reload guard)
│   ├── index.ts                                      (public barrel — see §3.3)
│   ├── mappers/                                       (15 files, one per entity — see §3.2)
│   └── repositories/                                   (15 implementation files + 15 *.test.ts — see §3.2)
├── tsconfig.json                                      (new this session)
├── vitest.config.ts                                   (new this session)
├── package.json                                       (updated: typescript, vitest, @types/node, @trading/domain deps; main/types now point to src/index.ts)
├── prisma/
│   ├── schema.prisma                                  (updated — see §3.4 for the 3 schema corrections made this session)
│   └── migrations/
│       └── ... (2 new migrations this session — see §3.4)
└── generated/client/                                   (Prisma Client output — gitignored, generated via `pnpm db:generate`)
```

### 3.2 The 15 repository implementations (all complete, all with integration tests passing against real Docker Postgres)

| Entity | Mapper | Repository | Notable characteristics |
|---|---|---|---|
| Portfolio | `portfolio-mapper.ts` | `prisma-portfolio-repository.ts` | First implemented — validated the mapper+repo+test pattern |
| User | `user-mapper.ts` | `prisma-user-repository.ts` | No `delete()` — matches contract |
| Asset | `asset-mapper.ts` | `prisma-asset-repository.ts` | `Json` metadata; no `delete()` (onDelete: Restrict from Transaction/Position) |
| Transaction | `transaction-mapper.ts` | `prisma-transaction-repository.ts` | Money/Decimal round-trip via string; `executedAt` defaults to `new Date()` when omitted (confirmed decision); no generic `update()` (historical fact, only `updateStatus()`) |
| Position | `position-mapper.ts` | `prisma-position-repository.ts` | **Schema correction**: added `currency` column (see §3.4); `upsert()` split into separate create/update payloads to avoid resetting `openedAt` on every update (real bug caught before shipping) |
| Decision | `decision-mapper.ts` | `prisma-decision-repository.ts` | Three independently-nullable Money fields sharing one nullable `currency` column; `exactOptionalPropertyTypes` required extracting `.toString()` calls to local consts before conditional spread (TS narrowing limitation — see §5) |
| DecisionEvent | `decision-event-mapper.ts` | `prisma-decision-event-repository.ts` | Append-only, no `update()`/`delete()`; `payload` defaults to `{}` when omitted (confirmed decision); `timestamp` always repository-assigned |
| Scenario | `scenario-mapper.ts` | `prisma-scenario-repository.ts` | `changes` Json column intentionally NOT read into the domain entity (matches domain's own shape decision); `updateChanges()` persists but never returns `changes` |
| WatchlistItem | `watchlist-item-mapper.ts` | `prisma-watchlist-item-repository.ts` | `create()` translates Prisma's `P2002` unique-constraint violation into the domain's `InvalidWatchlistItemError` |
| Alert | `alert-mapper.ts` | `prisma-alert-repository.ts` | No Money at all — `threshold` is a bare `Float` per schema |
| Notification | `notification-mapper.ts` | `prisma-notification-repository.ts` | **Confirmed decision**: `metadata` is `Json?` (nullable) in schema vs. non-nullable in domain — resolved entirely in the mapper (`null` → `{}` on read, never written as `null`), no migration |
| UserPreference | `user-preference-mapper.ts` | `prisma-user-preference-repository.ts` | Keyed by `userId`, not `id`; `notificationPreferences` Json cast on both create and update |
| MarketPrice | `market-price-mapper.ts` | `prisma-market-price-repository.ts` | **Schema correction**: added `currency` column (see §3.4); single-record-per-asset `upsert()`, no split needed (no `openedAt`-style field) |
| MarketEvent | `market-event-mapper.ts` | `prisma-market-event-repository.ts` | Append-only; `sequence` converted `BigInt` ↔ `number` (documented, accepted precision trade-off for realistic tick-counter ranges) |
| HistoricalPrice | `historical-price-mapper.ts` | `prisma-historical-price-repository.ts` | **Schema correction**: added `currency` column (see §3.4); composite PK `(assetId, timestamp)`; `create()` implemented via Prisma `upsert()` internally to satisfy the contract's documented idempotent-replay requirement without changing the method's public name; `timestamp` defaults to `new Date()` when omitted |

### 3.3 `packages/database/src/index.ts` — public barrel

Exports exactly two categories, by explicit decision this session (see §4):
- `prisma` (the shared client singleton — useful for future seed scripts / test cleanup)
- All 15 `Prisma*Repository` classes

Mappers are **not** exported — internal implementation detail of each repository, never part of the public contract.

### 3.4 Schema corrections made this session (in addition to Phase 2's earlier corrections already logged)

| Correction | Migration | Reason |
|---|---|---|
| Added `currency String` to `Position` | `20260913144307_add_currency_to_position` | Domain requires `averageEntryPrice`/`currentPrice` as `Money` sharing one currency; original schema had no column for it at all (not a nullability mismatch like the Notification one below — a genuinely missing column) |
| Added `currency String` to `MarketPrice` and `HistoricalPrice` | `20260913192914_add_currency_to_market_price_and_historical_price` | Same category of gap as Position, found while implementing `MarketPriceRepository`/`HistoricalPriceRepository` — `price`/`previousPrice`/`change` (MarketPrice) and `open`/`high`/`low`/`close` (HistoricalPrice) all needed a shared currency column that didn't exist |

Both corrections followed the same pattern already established in Phase 2: found by reading the domain entity and schema side-by-side before writing the mapper, flagged explicitly to the user with options, confirmed before touching `schema.prisma`.

---

## 4. Key Decisions Made This Session

| Decision | Reason |
|---|---|
| **Prisma↔domain mapping lives in a dedicated `packages/database/src/mappers/` module**, not inline in each repository | Resolved the one open item (§8.1) carried over from the previous session's handoff. Reduces duplication (the same Decimal→Money conversion pattern repeats across ~8 repositories), keeps repositories thin, keeps the conversion logic independently readable/testable. |
| **One barrel (`index.ts`) per workspace package, no barrels inside `src/repositories/` or `src/mappers/`** | Explicit discussion with the user about barrel-file risk (circular dependencies, tree-shaking). Distinguished "public package entrypoint" (low risk, single-level, matches the existing `@trading/domain` pattern) from "internal folder-by-folder barrels" (the genuinely risky pattern) — only the former is used here. |
| **Package entrypoint (`main`/`types`) points to `./src/index.ts`, not the raw generated Prisma client** | Corrected mid-session: the original Step 2 decision (before this package had any code) pointed `main`/`types` at `./generated/client/index.js`. Once a real public barrel existed, that config would have made `@trading/database`'s default import resolve to the raw Prisma client instead of our repositories — fixed to match `@trading/domain`'s own `main: "./src/index.ts"` pattern. |
| **`Transaction.executedAt` defaults to `new Date()` in the repository when omitted** | Confirmed with the user. The domain contract allows omitting it; the DB column has no default. Infrastructure fills the gap the domain contract left open. |
| **`DecisionEvent.payload` defaults to `{}` in the repository when omitted** | Confirmed with the user, after discussing why this is a structural fallback only (not a substitute for future per-event-type payload validation, which belongs in `validateNewDecisionEvent` if ever needed). |
| **`Notification.metadata` nullable/non-nullable mismatch resolved entirely in the mapper (`null` ↔ `{}`), no migration** | Confirmed with the user — the schema's nullable `Json?` is a superset of the domain's non-nullable requirement, so no schema change was needed, unlike the Position/MarketPrice/HistoricalPrice cases where the column was missing outright. |
| **`Position.upsert()` (and by extension, any future upsert with an "only set once" field) splits `create` and `update` payloads instead of sharing one object** | Real bug caught during Position implementation: a shared payload would have reset `openedAt` to "now" on every subsequent upsert, corrupting "when was this position first opened." |
| **`WatchlistItem.create()` relies on the DB's own `@@unique([userId, assetId])` constraint** (catches Prisma's `P2002`) rather than a pre-check `findFirst` + `create` | Avoids a race condition between the check and the insert; translates the low-level Prisma error into the domain's existing `InvalidWatchlistItemError` rather than inventing a new error type or leaking the raw Prisma error. |
| **`HistoricalPriceRepository.create()` uses Prisma's `upsert()` internally**, keeping the public method named `create()` | The domain contract's own module comment requires that "replaying the same candle does not create a duplicate row." Implemented as an internal implementation detail — the public API surface still matches the domain contract exactly. |
| **`MarketEvent.sequence`: `BigInt` (schema) ↔ `number` (domain) conversion accepted as a documented trade-off**, not "fixed" by changing either side | The domain's own validation only requires a non-negative integer; realistic per-asset tick counters will never approach `Number.MAX_SAFE_INTEGER`. Changing the domain to use `bigint` throughout was considered and rejected as unnecessary complexity for this project's actual scale (`03-non-functional-requirements.md`, Avoid Artificial Complexity). |

---

## 5. Corrections / Bugs Caught This Session (read before trusting anything as "already correct")

Continuing the practice from Phase 1 and earlier in Phase 2 — several real issues were only caught by reading actual files via filesystem MCP or by hitting real tool output, not by assumption:

1. **`packages/database/package.json` had no TypeScript/Vitest/`@trading/domain` dependency, and no `tsconfig.json`/`src/` existed at all** at the start of this session — Step 5 necessarily started with package setup (Step 5.1), not directly with repository code.
2. **`packages/database/package.json`'s `main`/`types` pointed to a Prisma output path that didn't exist yet** (`schema.prisma`'s generator had no `output` configured) — caught before running `db:generate` for the first time; resolved by adding `output = "../generated/client"` and choosing that path deliberately (Option A) over relying on Prisma's default `node_modules` resolution.
3. **Root `tsconfig.json`'s `references` array only listed `packages/domain`**, silently excluding `packages/database` from both the TypeScript build graph and, more importantly, from ESLint's `projectService`-based type-aware linting — this caused `packages/database/src/client.ts` and the Decision/Scenario mappers to be linted under a degraded "default project" fallback where real types (`@types/node`'s `process.env`, Prisma's generated enums) resolved as effectively `any`, producing misleading lint errors that had nothing to do with the actual code. Fixed by adding the missing reference.
4. **`eslint.config.js`'s ignore list didn't exclude `packages/database/generated/`** — ESLint was attempting to type-check Prisma's own generated output files, which aren't part of any tsconfig's `include`, producing dozens of unrelated parsing errors that had to be triaged away from the real issues first.
5. **`exactOptionalPropertyTypes: true` (already active in `tsconfig.base.json`) surfaced a real, repeated authoring mistake**: writing `field: input.field?.toString()` directly into a return object literal produces a property that is *present* with a possibly-`undefined` value, which this strict flag correctly rejects — the fix (conditional spread, `...(x !== undefined ? { field: y } : {})`) had to be applied consistently across `decision-mapper.ts`'s and `scenario-mapper.ts`'s `toPrismaCreateInput` functions. A second, more subtle variant of the same root cause was found in `decision-mapper.ts`: TS's control-flow narrowing did not reliably propagate through a *repeated* `input.entryPrice?.toString()` call inside an already-narrowed ternary branch — fixed by extracting the value to a local `const` first and narrowing on that instead, which is the reliable form of this pattern going forward.
6. **`decision-event-mapper.ts`'s `payload` write was missing the `as Prisma.InputJsonValue` cast** that `asset-mapper.ts` already used correctly for `metadata` — an inconsistency between two mappers doing conceptually the same Json-write operation, caught by the actual `tsc` error rather than by review.
7. **A stale `tsconfig.tsbuildinfo`** was suspected (and ruled out, not confirmed) as a possible cause of a persisting error during the Decision/Scenario mapper fix — deleting it and rebuilding was used as a diagnostic step; the real cause turned out to be item 5's narrowing issue, not caching. Documented here so a future session doesn't waste time re-suspecting the cache first without ruling out an actual code issue via the full error text.
8. **All 15 integration test files failed simultaneously with "60 skipped" the first time the full test command was run this session** — root cause was Docker's Postgres container not running at that moment (an environment/session-state issue, not a code issue). Confirmed via `docker compose ps` before spending time on more complex hypotheses (connection pool exhaustion, cross-file Prisma singleton contamination) that were raised as possibilities but not needed.

**Lesson reinforced (again):** every domain entity + repository contract was read directly via filesystem MCP immediately before writing its mapper, for all 15 entities across this entire session — this caught 3 genuine schema/domain mismatches (Position, MarketPrice, HistoricalPrice missing `currency`) before they became runtime bugs. Continue this without exception for Step 6 and beyond.

---

## 6. How to Resume From Here (Phase 2 Step 6 kickoff)

1. Read this file in full.
2. Use the filesystem MCP to independently verify current repo state — confirm `packages/database/src/repositories/` has 15 implementation files + 15 `*.test.ts` files (30 total), confirm `packages/database/src/mappers/` has 15 files, confirm `packages/database/src/index.ts` exports `prisma` + all 15 `Prisma*Repository` classes, confirm `packages/database/prisma/schema.prisma` has `currency` columns on `Position`, `MarketPrice`, and `HistoricalPrice` (§3.4).
3. Confirm local repo state: `git status`, `git branch --show-current`, `git log --oneline -20`.
4. Confirm Docker Postgres is running before doing anything that touches the database: `docker compose ps` (this bit the team once already this session — see §5, item 8).
5. Discuss and resolve the three open questions in §2 before writing any seed code — especially the "seed" naming ambiguity (Prisma DB seed vs. Demo Mode simulation seed), which is genuinely confusing terminology carried over from the SDDs themselves and worth clarifying explicitly with the user before it causes a real mistake.
6. Re-read `05-data-model.md` §33-37 (Demo Data Strategy) and `12-demo-mode-spec.md` §13 (Initial Dataset) together once more before starting — Step 6's seed script is what those sections describe as "Layer 1 — Seed Data."
7. Propose Phase 2 Step 6 as small, approvable sub-steps (e.g., 6.1 — seed script scaffolding and the design questions above; 6.2 — users/portfolios/assets; 6.3 — positions/transactions with realistic variation; 6.4 — decisions/scenarios/alerts/notifications; 6.5 — historical price data; 6.6 — wiring into an npm script + verification), rather than attempting the whole seed dataset in one shot.

---

## 7. Last Relevant Commits (this session, chronological)

```
chore(database): prepare package for typescript source and prisma client generation
chore(config): register @trading/database in root tsconfig project references
chore(lint): exclude generated prisma client output from eslint
feat(database): add prisma client singleton
feat(database): add portfolio mapper between prisma model and domain entity
feat(database): implement PrismaPortfolioRepository
feat(database): add public barrel exporting prisma client and repositories
fix(database): point package entrypoint to src barrel instead of generated client
test(database): add integration test for PrismaPortfolioRepository crud cycle
chore(database): load env vars in test scripts via dotenv-cli
feat(database): implement PrismaUserRepository with mapper, barrel export and integration tests
feat(database): implement PrismaAssetRepository with mapper, barrel export and integration tests
feat(database): implement PrismaTransactionRepository with money/decimal mapping, status lifecycle and integration tests
fix(database): implement PrismaPositionRepository, preserving openedAt across upserts
feat(database): implement Decision, DecisionEvent and Scenario repositories with mappers and integration tests
feat(database): implement WatchlistItem, Alert, Notification and UserPreference repositories with mappers and integration tests
feat(database): implement MarketPrice, MarketEvent and HistoricalPrice repositories, completing all 15 repository implementations
```

Exact order/squashing at merge time is a decision for the next PR review, not fixed here.

---

## 8. Open Items / Pending Decisions

- **8.1 — Prisma↔domain mapping location** — ✅ RESOLVED this session (dedicated `mappers/` module, confirmed with user).
- **8.2 — Prisma major version** — still deferred (release candidate, not stable per `04-tech-stack.md` §2). Not revisited this session; still on `6.19.3`. Revisit only once Prisma 8 reaches a real stable release, as its own isolated decision/PR.
- **8.3 — Seed workflow design** (Phase 2 Step 6, not started) — see §2 for the three specific open design questions that must be resolved before writing code, not just "not yet scoped" as the previous handoff said — now more concretely blocked on those three questions.
- **8.4 — Local reset workflow** (Phase 2 Step 7, not started) — still only ad-hoc `docker compose down -v` used/verified; a documented, repeatable command/script per `14-deployment-spec.md` §21 has not been created.
- **8.5 (carried over, still open, still non-blocking) — Branch-source enforcement for `main`** — deferred since Phase 0.
- **8.6 (carried over, still open, still non-blocking) — GitHub default branch still `main`** — deferred since Phase 0.
- **8.7 (new, non-blocking) — `packages/database`'s `typescript` devDependency (`^5.7.3`) is behind the root `package.json`'s `^6.0.3`** — noticed during Step 5.1, not fixed (out of scope for that sub-step, no functional impact observed). Worth a deliberate, isolated version-alignment pass at some point, not bundled into feature work.