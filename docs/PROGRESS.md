# PROGRESS.md

**Project:** Trading Analytics Platform
**Last updated:** End of Phase 1 (complete) — cutover to new chat for Phase 2
**Current branch context:** `feat/domain-package-setup` (created from `develop`, not yet merged — verify at start of next session whether it should be merged now that Phase 1 is closed)

> This file is the source of truth for resuming work across chat sessions.
> Do not rely on assistant memory — read this file first, then the relevant
> SDD documents in `docs/`, then `CONTRIBUTING.md` for workflow rules.
>
> **Filesystem MCP access confirmed working**: the assistant has direct
> read access to this repository via the filesystem MCP server (root:
> `Internal Projects/trading-analytics-platform`). From Phase 2 onward,
> the assistant should read files directly via this MCP rather than
> asking the user to paste file contents, whenever verifying existing
> code, checking current state, or confirming a fix landed correctly.

---

## 1. Current Phase / Step

**Phase 0 — Repository Foundation: ✅ COMPLETE**

**Phase 1 — Product and Domain Foundation: ✅ COMPLETE**

All sub-steps closed:

- [x] Step 1 — `packages/domain` package scaffolded (TypeScript + Vitest)
- [x] Step 2 — `User`, `Asset` entities + enums + invariants + tests
- [x] Step 3 — `Portfolio` entity + invariants + tests
- [x] Step 4 — `Transaction` entity (lifecycle status) + invariants + tests
- [x] Step 5 — `Position` entity + invariants + tests
- [x] Step 6 — Support entities: `WatchlistItem`, `Notification`, `Alert`, `UserPreference` + invariants + tests
- [x] Step 7 — Market entities: `MarketPrice`, `MarketEvent`, `HistoricalPrice` + invariants + tests
- [x] Step 8 — `Decision`, `DecisionEvent` + invariants + tests
- [x] Step 9 — `Scenario` entity + invariants + tests (**closed this session** — see §4 "Corrections" below; this had been marked done previously but the files did not actually exist in the repo)
- [x] Step 10a — `Money` value object (backed by `decimal.js`) + tests
- [x] Step 10b — Retrofit `Transaction`, `Position`, `MarketPrice`, `HistoricalPrice` to `Money`
- [x] Open item 7.1 — Retrofitted `MarketEvent.price` and `Decision.entryPrice/targetPrice/stopPrice` to `Money`; fixed a pre-existing gap where `targetPrice`/`stopPrice` were never validated; `Alert.threshold` intentionally kept as `number` (documented reason: not all alert types are currency amounts)
- [x] Step 11 — Domain calculations module, all 8 functions implemented:
  - `calculatePositionMetrics`
  - `calculatePortfolioMetrics`
  - `calculateAllocation`
  - `calculateAttribution`
  - `calculateDrawdown`
  - `calculateVolatility`
  - `calculateScenarioImpact`
  - `calculatePortfolioPulse`

**Phase 1 has no open items.** All 16 domain entities, the `Money` value object, and the full calculations module are implemented, tested, and exported from the package barrel.

---

## 2. Next Phase

**Phase 2 — Database and Infrastructure** (per `15-implementation-plan.md` §7), not yet started.

Scope: PostgreSQL, Docker, Docker Compose, migration tooling (Prisma per `04-tech-stack.md` §28), initial schema, migrations, seed workflow, repository interfaces, PostgreSQL repository implementations.

### Expected length warning

Phase 1 took 2 chat sessions. Phase 2 is expected to be **longer** — it touches infrastructure (Docker, Postgres, Prisma schema, migrations) plus repository interfaces/implementations for all 16 entities, which is a wider surface than domain-only logic. **The assistant should proactively tell the user when context is getting long and it's time to close the chat and continue Phase 2 in a new session** (updating this PROGRESS.md at that cutover point, same as was done at the Phase 1 → Phase 2 boundary), rather than waiting for the phase to fully complete before suggesting a cutover.

---

## 3. What's Been Implemented (`packages/domain`)

### Structure

```text
packages/domain/
├── package.json              (name: @trading/domain; deps: decimal.js; devDeps: typescript, vitest)
├── tsconfig.json              (extends ../../tsconfig.base.json, rootDir: src, include: src)
├── vitest.config.ts
└── src/
    ├── index.ts                          ← single barrel, exports everything directly
    ├── entities/
    │   ├── enums.ts                       (all enums; ScenarioStatus added this session)
    │   ├── user.ts / user.test.ts
    │   ├── asset.ts / asset.test.ts
    │   ├── portfolio.ts / portfolio.test.ts
    │   ├── transaction.ts / transaction.test.ts       (Money)
    │   ├── position.ts / position.test.ts             (Money)
    │   ├── watchlist-item.ts / watchlist-item.test.ts
    │   ├── notification.ts / notification.test.ts
    │   ├── alert.ts / alert.test.ts                    (threshold intentionally number, not Money)
    │   ├── user-preference.ts / user-preference.test.ts
    │   ├── market-price.ts / market-price.test.ts      (Money)
    │   ├── market-event.ts / market-event.test.ts      (Money)
    │   ├── historical-price.ts / historical-price.test.ts (Money, OHLC ordering invariants)
    │   ├── decision.ts / decision.test.ts              (Money, nullable entry/target/stop)
    │   ├── decision-event.ts / decision-event.test.ts
    │   └── scenario.ts / scenario.test.ts              (added this session)
    ├── value-objects/
    │   └── money.ts / money.test.ts        (Money value object, backed by decimal.js)
    └── calculations/
        ├── position-metrics.ts / .test.ts
        ├── portfolio-metrics.ts / .test.ts
        ├── allocation.ts / .test.ts
        ├── attribution.ts / .test.ts
        ├── drawdown.ts / .test.ts               (also exports InsufficientDataError)
        ├── volatility.ts / .test.ts             (imports InsufficientDataError from drawdown.ts)
        ├── scenario-impact.ts / .test.ts
        └── portfolio-pulse.ts / .test.ts
```

**Barrel (`src/index.ts`) is fully up to date** — every entity, the value object, and every calculation module is exported. This was verified and fixed this session (see §4).

### Test count

All tests passing as of the last verified run this session (exact count not re-tallied here — run `pnpm --filter @trading/domain test` to get the current number; expect somewhere around 130+ given the volume of calculation tests added since the ~106 recorded at the last PROGRESS.md checkpoint).

---

## 4. Corrections Made This Session (read this before assuming anything is "as previously documented")

The previous `PROGRESS.md` (written mid-Step-10b) turned out to contain **two inaccuracies** that were only caught by directly reading the filesystem via MCP rather than trusting the document. Recorded here so the same mistake isn't repeated blindly in a future session:

1. **`position.ts`/`position.test.ts`** were listed as "✅ confirmed correct" in the prior PROGRESS.md, but when the user pasted `position.ts`, it was still the *original*, non-`Money` version. This caused a wasted round-trip (delivered a test file assuming the wrong entity shape). **Resolved**: both files retrofitted and confirmed passing.

2. **`Scenario` entity** was listed as "Step 9 — ✅ complete" in the prior PROGRESS.md, but `entities/scenario.ts` and `entities/scenario.test.ts` did not exist anywhere in the repository, and `ScenarioStatus` was missing from `enums.ts`. **Resolved**: `ScenarioStatus` added to `enums.ts`; `Scenario` entity and its test created from scratch this session, following the same pattern as `Portfolio` (closest structural analog).

**Lesson applied**: from Phase 2 onward, the assistant reads files directly via the filesystem MCP to verify actual repo state before treating any prior PROGRESS.md claim as ground truth, rather than trusting the document text alone.

---

## 5. Key Decisions Made (Phase 1, cumulative)

| Decision | Reason |
|---|---|
| **Single barrel at package root** (`src/index.ts`), no nested barrels | Avoids import-cycle risk and unnecessary indirection. |
| **Money value object backed by `decimal.js`** | Matches Prisma's internal `Decimal` implementation, avoiding conversion friction once the persistence layer is built in Phase 2. Documented in `04-tech-stack.md` §28.1 and `05-data-model.md` §39. |
| **`quantity`/`volume` remain plain `number`, never `Money`** | Counts of units, not currency amounts. |
| **Position/Scenario: structural invariants only, no calculation logic in the entity file itself** | Calculation logic lives in `calculations/`, per `06-architecture.md` §10. Keeps "what shape is valid" separate from "how it's computed". |
| **`isStaleMarketEvent()` kept inside `market-event.ts`**, not in `calculations/` | Accepted exception: trivial, single-field ordering comparison intrinsic to `MarketEvent.sequence`, not a cross-entity financial calculation. |
| **Enums only added when the SDD explicitly enumerates values** | Deliberate fidelity-to-spec rule; e.g. `Alert.condition`, `Notification.type`, `Decision.riskLevel`/`outcome` stay as plain strings because the data model does not close them to a fixed list. |
| **Colocated tests** (`x.ts` + `x.test.ts`), not a separate `__tests__/` folder | Vitest/Testing Library community standard; consistent with future `apps/web` React component tests. |
| **`MarketEvent.price` and `Decision.entryPrice/targetPrice/stopPrice` retrofitted to `Money`; `Alert.threshold` left as `number`** | Resolves open item 7.1. The three price fields feed authoritative calculations (Decision Replay, Expected-vs-Actual); `Alert.threshold` is not always a currency amount (VOLATILITY/ALLOCATION alert types use non-currency thresholds). |
| **Fixed a pre-existing gap**: `Decision`'s original validation only checked `entryPrice`, never `targetPrice`/`stopPrice` | Fixed in the same pass as the Money retrofit, since it touched the same fields. Added a new invariant: when 2+ of entry/target/stop are provided, they must share currency. |
| **`calculations/` module is generally read-only over entities**: functions take already-constructed, already-validated entities as input and do not re-validate structural invariants | Functions do add narrow *defensive* guards against calculation-breaking edge cases (e.g. zero cost basis before a percentage division), documented per-function as distinct from re-validating entity invariants. |
| **`calculatePortfolioMetrics` scope reduced vs. the full field list in `05-data-model.md` §24** | Only `totalValue`, `investedValue`, `unrealizedPnL`, `unrealizedPnLPercent` are calculated from `Portfolio` + `Position[]` alone. `cashValue`, `dailyChange(%)`, `realizedPnL`, `drawdown`, `volatility` are explicitly NOT fabricated — they require inputs (cash ledger, historical snapshots, `Transaction[]`) not yet threaded through any calculation. Documented as a deliberate, honest limitation, not an oversight. |
| **`calculateAllocation` is generic over a `groupBy: (position) => string` callback**, rather than hardcoding one grouping dimension or requiring `Asset[]` as an input | Supports all 4 allocation dimensions from the spec (asset/assetType/sector/currency) without coupling the calculations module to the `Asset` entity. Caller resolves assetType/sector via its own asset lookup. |
| **Allocation percentages are NOT rebalanced to force an exact sum of 100** | Doing so would mean adjusting a reported value to make the total look clean — treated as fabricating data. Minor floating-point drift in the sum is expected and accepted. |
| **`calculateDrawdown`/`calculateVolatility` operate at single-asset level only, not portfolio level** | True portfolio-level drawdown/volatility requires a reconstructed portfolio value time series from `Transaction[]` (execution dates + historical composition), which doesn't exist as an input to any calculation yet. Documented as future work, not silently approximated. |
| **Volatility uses *sample* standard deviation (n-1, Bessel's correction), not population** | Conventional choice for historical volatility in finance — observed returns are treated as a sample, not the full population of possible returns. |
| **`calculateVolatility` requires ≥3 price points (≥2 returns); `calculateDrawdown` requires ≥2 price points** | Below these, the statistic is undefined (division by zero in sample variance for volatility; no drawdown possible from a single point). Both throw `InsufficientDataError` — a calculation precondition failure, distinct from a valid empty/zero business state. |
| **`calculateScenarioImpact` does NOT accept a `Scenario` entity** — takes `Portfolio`, `Position[]`, and a plain `ScenarioChange[]` (`{ assetId, percentChange }[]`) instead | `Scenario`'s persistence shape for variable changes is explicitly left open by `05-data-model.md` §15. Translating a persisted `Scenario` into `ScenarioChange[]` is the application layer's job — keeps domain calculations decoupled from how scenarios are eventually stored. |
| **`calculatePortfolioPulse` excludes `Exposure` and `Liquidity` dimensions entirely; `Volatility`/`Drawdown` are optional inputs, not calculated internally** | `Exposure` has no clear definition distinct from allocation given current data. `Liquidity` is mentioned in `01-product-spec.md` §5.3 but absent from the definitive dimension list in `05-data-model.md` §29, and there's no liquidity-related field anywhere in the domain model. `Volatility`/`Drawdown` are asset-level (see above), so the caller supplies an already-calculated result (e.g. for the largest position) or the dimension reports `"UNKNOWN"`. |
| **Pulse classification thresholds are explicitly documented as arbitrary placeholders**, not a validated product decision | Needed for deterministic, testable classification (FR-007) without fabricating a "tuned" business threshold that doesn't actually exist yet. Flagged in code comments and here so a future session doesn't mistake them for settled product decisions. |
| **Pulse's `explanation` strings are plain hardcoded English in the domain layer** | Accepted as low-risk, deferrable tech debt: the actual data is `classification` + `value`; a future i18n pass can have the presentation layer construct its own localized string from those two fields without touching domain calculations at all. |
| **Array indexing safety pattern under `noUncheckedIndexedAccess` + `no-non-null-assertion` lint rule** | When accessing `arr[0]` after already knowing the array is non-empty, TypeScript still types it as possibly `undefined` and the codebase's lint config forbids `!`. Standard fix used throughout: `const first = arr[0]; if (!first) { ...guard...; }` — never `arr[0]!`, never bare `arr[0]?.x` when a definite value is required afterward. |
| **Numeric values interpolated into template literals must be wrapped in `String(...)`** | `@typescript-eslint/restrict-template-expressions` forbids raw `number` interpolation. `.toFixed()` results (already `string`) don't need wrapping; raw `const` thresholds do. |

---

## 6. How to Resume From Here (Phase 2 kickoff)

1. Read this file in full.
2. Use the filesystem MCP to independently verify current repo state before trusting any claim above — confirm `packages/domain/src/index.ts` exports everything listed in §3, and spot-check 1-2 entity files match what's documented.
3. Confirm local repo state: `git status`, `git branch`, `git log --oneline -15`.
4. Decide whether `feat/domain-package-setup` should be merged into `develop` now that Phase 1 is fully closed, or whether Phase 2 continues on the same branch / a new one — this is a decision for the user, not an assumption to make silently.
5. Re-read `14-deployment-spec.md` and `04-tech-stack.md` (Prisma/PostgreSQL sections) before proposing Phase 2 Step 1, since those documents define the target architecture Phase 2 must follow.
6. Propose Phase 2 Step 1 as a small, approvable slice (per the working rules) — do not propose all of Docker + Postgres + Prisma schema + migrations + repositories as one step.
7. Watch context length proactively during Phase 2 and suggest a chat cutover (with an updated PROGRESS.md) well before the phase is fully done, given the expected length warning in §2.

---

## 7. Open Items / Pending Decisions

None blocking Phase 2 kickoff. Two minor, non-blocking notes:

- **7.1 — Branch-source enforcement for `main`** (CI check requiring PRs into `main` come from `develop`) — deferred since Phase 0, still not implemented. Not urgent.
- **7.2 — GitHub default branch still `main`** (relatively empty vs `develop`) — decision left open since Phase 0.
