# PROGRESS.md

**Project:** Trading Analytics Platform
**Last updated:** End of Phase 3 (fully closed — Portfolios, Positions, Transactions).
Cutover to new chat to decide the next phase: either Fase 4 (RBAC, still deliberately
deferred, see §4) or jump ahead to Fase 5 (Frontend Foundation) per the project's
stated priority of getting the public demo working end-to-end first (project rule 7).
**Current branch context:** verify with `git status`/`git log` at the start of next
session before trusting this claim, per the recurring lesson from every prior phase.

> This file is the source of truth for resuming work across chat sessions.
> Do not rely on assistant memory — read this file first, then the relevant
> SDD documents in `docs/`, then `CONTRIBUTING.md` for workflow rules.
>
> **Filesystem MCP access confirmed working** for this project throughout
> this entire session (root: `Internal Projects/trading-analytics-platform`).
> Every file was read directly via this MCP immediately before writing or
> editing anything that depended on it — this remains a hard rule for this
> project (see §6). This session, that discipline is what caught two
> separate real bugs (see §5) that would otherwise have been very
> confusing to diagnose from error messages alone.

---

## 1. Current Phase / Step

**Phase 0 — Repository Foundation:** ✅ COMPLETE
**Phase 1 — Product and Domain Foundation:** ✅ COMPLETE
**Phase 2 — Database and Infrastructure:** ✅ COMPLETE
**Phase 3 — Backend/API Foundation:** ✅ COMPLETE (fully closed this session)

All sub-steps closed:

- [x] Step 1 — Bootstrap `apps/api` (Express + TypeScript, minimal server)
- [x] Step 2 — Base middleware: request ID, centralized error handler
- [x] Step 3 — Health (`GET /health`) and readiness (`GET /health/ready`) endpoints
- [x] Step 4 — Authentication: JWT + bcryptjs login, JWT verification middleware,
      protected `GET /api/v1/auth/me`
- [x] Step 5 — Portfolios: `GET`, `POST`, `GET /:id`, `PATCH /:id`,
      `POST /:id/archive` (full FR-008 through FR-011 coverage)
- [x] Step 6 — Positions: `GET` (list), `GET /:id` (detail with derived metrics) —
      deliberately read-only per domain rules (see §4)
- [x] Step 7 — Transactions: `GET` (list, with filters), `GET /:id`, `POST` (create,
      with synchronous position recalculation) — verified end-to-end manually

**Phase 3 has no remaining scope as originally planned.** RBAC (role-restriction
middleware) remains deliberately deferred — see §4 decision table (carried over from
the previous session, still valid, no route has needed it yet).

---

## 2. Next Phase / Step

**Decision not yet made — to be decided at the start of the next session.**

Per `15-implementation-plan.md` §4 (Phase Overview), the next phases in strict document
order would be:
```text
Phase 4  → Authentication/RBAC   (still deferred — see §4 below)
Phase 5  → Frontend foundation
Phase 6  → Core portfolio workflows
Phase 7  → Transactions and positions   (backend side already done — this session)
Phase 8  → Tables, filters and analytics
```

However, `00-overview.md` §2.2 and project rule 7 (in the assistant's operating
instructions for this project) explicitly prioritize getting the **public demo
(frontend + mock infra) working end-to-end** as soon as possible, over completing the
full real backend first. Phases 6-7 (frontend core workflows, transactions/positions
UI) do not strictly require Phase 4 (RBAC) to exist, since RBAC has no real consumer
yet (see §4).

**Recommended discussion for next session's first message:** decide between:
- **Option A:** Continue backend-first, strictly following the numbered phases —
  next would be Assets API (`GET /api/v1/assets`, needed by Transactions' frontend
  form and currently missing entirely — there is no `assets.routes.ts` yet, which
  is why this session had to read asset IDs directly from the seed output / psql
  instead of hitting a real endpoint).
- **Option B:** Pivot to Phase 5 (Frontend Foundation) now, using the mock
  infrastructure path (`12-demo-mode-spec.md`) to get the demo UI running against
  Portfolios/Positions/Transactions as they exist today, deferring further backend
  build-out (Assets API, Analytics, Decisions, Scenarios) until the frontend shell
  needs them.

No default was chosen this session — this is an open decision for the user to make
first, before any code is written next time.

---

## 3. What's Been Implemented This Session (Phase 3, Steps 5-7)

### 3.1 Step 5 — Portfolios (full CRUD + archive)

```text
apps/api/src/
├── schemas/
│   └── portfolio.schema.ts      # createPortfolioRequestSchema,
│                                   # updatePortfolioRequestSchema (name/description
│                                   # only — baseCurrency deliberately immutable,
│                                   # see §4)
├── services/
│   └── portfolio.service.ts       # listPortfolios, createPortfolio,
│                                    # getPortfolioById (404-on-mismatch ownership),
│                                    # updatePortfolio, archivePortfolio (idempotent)
└── routes/
    └── portfolios.routes.ts        # GET / POST / GET :id / PATCH :id /
                                      # POST :id/archive, all behind `authenticate`
```

**Endpoints implemented:**
```text
GET    /api/v1/portfolios
POST   /api/v1/portfolios
GET    /api/v1/portfolios/:portfolioId
PATCH  /api/v1/portfolios/:portfolioId
POST   /api/v1/portfolios/:portfolioId/archive
```

All verified manually end-to-end (valid/invalid data, ownership mismatch, idempotent
archive twice, `baseCurrency` in a PATCH body silently ignored as intended).

### 3.2 Step 6 — Positions (read-only)

```text
apps/api/src/
├── services/
│   └── position.service.ts    # listPositions, getPositionById (with derived
│                                # metrics via calculatePositionMetrics)
└── routes/
    └── positions.routes.ts     # GET (list), GET /:id, both nested under
                                  # /api/v1/portfolios/:portfolioId/positions
```

**Key decision, not an oversight:** there is deliberately no `POST`/`PATCH`/`DELETE`
for positions. `05-data-model.md` §8 is explicit that a Position is a materialized
projection derived from transaction history + market data, not something created
directly. `07-api-spec.md` §12 only defines `GET` operations for positions, confirming
this at the API-contract level too. Writes to Position happen indirectly, only through
transaction creation (see 3.3 below).

`allocation` is intentionally omitted from the position-detail response, even though
`07-api-spec.md` §12's example includes it — `position-metrics.ts`'s own scope note
says allocation needs the portfolio's total value (belongs to
`calculatePortfolioMetrics`/`calculateAllocation`), which this project has not built
yet. Adding it here would be a premature cross-dependency (NFR-070). Revisit when a
portfolio-level analytics/overview endpoint exists.

### 3.3 Step 7 — Transactions (the significant piece)

This is the first step where real, non-trivial business logic had to be **designed**,
not just wired — no prior code in the domain layer computed how a transaction changes
a position.

**New domain code (packages/domain):**
```text
packages/domain/src/
├── value-objects/
│   ├── money.ts          # + divide(divisor: number | string): Money
│   │                        # (new method, symmetric with multiply(); needed for
│   │                        # weighted-average-cost math, which Money had no way
│   │                        # to express before this session)
│   └── money.test.ts       # + describe("Money.divide") block: normal division,
│                             # precision (0.3/0.1 === 3, not 2.9999...), division
│                             # by zero, round-trip with multiply
└── calculations/
    ├── position-recalculation.ts        # NEW FILE
    │   ├── InsufficientPositionQuantityError
    │   ├── PositionRecalculationResult (type; null means "close the position")
    │   └── calculatePositionAfterTransaction(existingPosition, transaction)
    │       - BUY, no existing position -> opens position at tx price/quantity;
    │         currentPrice seeded from tx price (only known price at that point)
    │       - BUY, existing position -> weighted-average-cost:
    │         newAvgPrice = (existingQty*existingAvg + txQty*txPrice) / newQty;
    │         currentPrice left untouched (tracks market data, not trade price)
    │       - SELL, no existing position -> throws
    │         InsufficientPositionQuantityError
    │       - SELL, qty > held -> throws InsufficientPositionQuantityError
    │       - SELL, qty === held -> returns null (position closes)
    │       - SELL, qty < held -> reduces quantity; averageEntryPrice of
    │         remaining shares does NOT change (standard weighted-average-cost
    │         accounting)
    └── position-recalculation.test.ts    # NEW FILE, full coverage of the above
```

`packages/domain/src/index.ts` updated to export the new calculation module and its
types/errors.

**New `apps/api` transaction capability:**
```text
apps/api/src/
├── schemas/
│   └── transaction.schema.ts     # createTransactionRequestSchema (nested
│                                    # moneyRequestSchema: { amount, currency }),
│                                    # listTransactionsQuerySchema (filters)
├── services/
│   └── transaction.service.ts     # listTransactions, getTransactionById,
│                                    # createTransaction — full orchestration:
│                                    # 1. verify portfolio ownership
│                                    # 2. verify asset exists (404 if not)
│                                    # 3. validateNewTransaction (domain)
│                                    # 4. persist transaction (starts DRAFT)
│                                    # 5. read existing position, call
│                                    #    calculatePositionAfterTransaction
│                                    # 6. upsert or delete the position
│                                    # 7. mark transaction COMPLETED
└── routes/
    └── transactions.routes.ts      # GET (list w/ filters), GET /:id, POST,
                                      # nested under
                                      # /api/v1/portfolios/:portfolioId/transactions
```

**Deliberate scope decision, agreed with the user before writing code:** transaction
creation is **synchronous** for now, not the async job/`jobId` flow sketched in
`07-api-spec.md` §14. Background operations are Phase 10 of the implementation plan
and don't exist yet; introducing async orchestration for a single call site now would
be solving job infrastructure prematurely (NFR-070). The response shape can grow a
`processing` field alongside `transaction` later without a breaking change.

**Error handling extended:** `apps/api/src/middleware/error-handler.ts`'s duck-typed
domain-error regex widened from `/^Invalid.+Error$/` to `/^(Invalid|Insufficient).+Error$/`
so `InsufficientPositionQuantityError` (a business-rule violation, not a shape
violation, but still "the request was invalid") also normalizes to 400
`VALIDATION_ERROR` automatically, with zero additional code needed for this or future
`Insufficient*Error` classes.

**Verified end-to-end manually** (real REST client, not just typecheck — see §5 for
why this distinction mattered this session):
- BUY with no existing position -> opens position, avg price = tx price
- second BUY -> weighted-average recalculated correctly (manually cross-checked the
  arithmetic against the API response)
- SELL with quantity greater than held -> `400 VALIDATION_ERROR`
- SELL with exact held quantity -> `201`, `data.position: null`, confirmed via a
  follow-up `GET .../positions` that the position actually disappeared
- `GET .../transactions?type=SELL` filter -> correct subset returned

---

## 4. Key Decisions Made This Session

| Decision | Reason |
|---|---|
| **Portfolio `PATCH` accepts only `name` and `description`; `baseCurrency` is immutable after creation** | Changing a portfolio's base currency once transactions exist would silently invalidate historical valuations (`05-data-model.md` §43, Historical Integrity). Confirmed explicitly with the user before implementing. |
| **`GET /portfolios/:id` (and every other by-id lookup added this session) returns 404, never 403, when the resource belongs to another user** | Anti-enumeration: avoids confirming to an unauthorized caller that a given ID even exists. Consistent with the anti-enumeration decision already made for login in the previous session (`09-security-spec.md` §51, §14-15 IDOR Protection). User explicitly chose 404 over 403 when asked. |
| **Portfolio archive is idempotent (always 200, never 409), but returns `meta.alreadyArchived: boolean`** | Archiving an already-archived portfolio isn't a real error — forcing 409 would add client-side special-casing with no benefit. But "idempotent" doesn't mean "uninformative": the flag lets the frontend show the right toast ("archived" vs "was already archived") without inventing an error code for a non-error. User explicitly asked for this distinction before it was designed this way. |
| **No `POST`/`PATCH`/`DELETE` for Positions — read-only by design** | `05-data-model.md` §8 and `07-api-spec.md` §12 both establish Position as a derived/materialized entity, not a directly-created one. Writes only happen through transaction creation. Confirmed with the user before starting Positions work. |
| **`allocation` omitted from position detail response** | Requires portfolio total value (`calculatePortfolioMetrics`), which this project hasn't built yet. Confirmed with the user rather than reaching for that dependency prematurely. |
| **Domain error-handler mapping extended to a naming-convention regex `/^(Invalid\|Insufficient).+Error$/` rather than a shared base class** | Keeps `apps/api`'s error-handling middleware infrastructure-agnostic (no new import from `@trading/domain`), consistent with the duck-typing approach already chosen in the previous session for `Invalid*Error`. Explicitly re-confirmed with the user when `InsufficientPositionQuantityError` didn't fit the original regex. |
| **`Money` gained a `divide()` method** | Weighted-average-cost calculation requires division; `Money` previously only had `add`/`subtract`/`multiply`. Symmetric, minimal addition using `decimal.js`'s `.dividedBy()` internally, consistent with how `multiply()` is implemented. Confirmed with the user before touching this shared value object, since it's used across the whole domain layer. |
| **Position recalculation logic (`calculatePositionAfterTransaction`) lives in `packages/domain/src/calculations/`, not inline in `apps/api`'s transaction service** | Keeps the weighted-average-cost accounting deterministic and independently testable (NFR-042), reusable if a future demo mock repository needs the same math, and consistent with where every other calculation (`portfolio-metrics.ts`, `allocation.ts`, etc.) already lives. |
| **SELL with no existing position, or SELL exceeding held quantity, throws `InsufficientPositionQuantityError` rather than silently succeeding or going negative** | Explicit business-rule design decision, confirmed with the user during the design proposal for Transactions, before any code was written. |
| **Transaction creation is synchronous; the async job/`jobId` flow from `07-api-spec.md` §14 is deferred to Phase 10 (Background Operations)** | Background job infrastructure doesn't exist yet; building it for a single call site now would be premature (NFR-070). Confirmed with the user before designing Transactions. |
| **Steps 4-6 of `createTransaction` (persist transaction -> recalculate position -> mark COMPLETED) are NOT wrapped in a single DB transaction yet** | Known, deliberately flagged gap against `NFR-074` (Atomic Business Operations) — a failure partway through could leave a transaction stuck in `DRAFT` with no corresponding position update. Not resolved this session; explicitly deferred as an open item (see §8) rather than silently left unaddressed. Wrapping this in Prisma's `$transaction` is the natural follow-up once the endpoint was otherwise verified working, which it now is. |
| **No `controller` layer separate from route handlers — routes ARE the (thin) controllers** | Explicitly discussed with the user. The route handlers only parse input (Zod), call the service, and shape the response/error — exactly what a controller should do; splitting it into a separate file today would add a layer with no real benefit at this project's size (NFR-070). Flagged as an **optional future step**: revisit once the full API surface exists, if routes start accumulating non-trivial parsing/mapping logic. |

---

## 5. Corrections / Bugs Caught This Session

Same discipline as every prior phase — every fix below was found by reading real files
via the filesystem MCP or by hitting real terminal/compiler output, never assumed:

1. **`apps/api/tsconfig.json` was missing a project reference to `packages/domain`.**
   Surfaced as 85 TS6059/TS6307 errors ("File X is not under rootDir" / "not listed in
   the file list of project") the moment `apps/api` code imported directly from
   `@trading/domain` for the first time (`portfolio.service.ts`'s
   `validateNewPortfolio` import — every prior `apps/api` import of domain types had
   been *transitive*, through `@trading/database`, which already had the reference).
   This is the exact same class of bug already documented in the previous session's
   PROGRESS.md for `packages/database`, but this time triggered on the *consumer*
   side. Fixed by adding `{ "path": "../../packages/domain" }` to
   `apps/api/tsconfig.json`'s `references` array, before the existing
   `packages/database` reference.
   **Durable lesson (elevated from a one-off note to a general rule this session):**
   any new *direct* import from `apps/api` (or any composite project) to another
   composite package requires adding that package's reference to the importer's
   `tsconfig.json`, regardless of whether the type was already reachable
   *transitively* before. Transitive reachability does not substitute for a direct
   reference once a direct import is written.

2. **`exactOptionalPropertyTypes: true` rejected passing Zod's `.optional()` output
   straight through to a hand-written interface with an optional field**, twice this
   session (once in `portfolios.routes.ts` for `description`, once in
   `portfolio.service.ts`'s `updatePortfolio` for the same reason but one layer
   deeper — passing a whole object typed as a separately-declared interface directly
   into `Partial<Pick<Portfolio, ...>>`, which TypeScript could not verify
   structurally under this flag even though both types describe the same "optional,
   no explicit undefined" shape). Both fixed with a conditional spread
   (`...(x !== undefined ? { x } : {})`), the same pattern already established in the
   previous session for `error-handler.ts`. **Durable lesson:** whenever an optional
   field crosses a type boundary under this flag — even between two independently
   declared types that look identical — rebuild the object via conditional spread at
   that boundary rather than assuming structural equivalence will typecheck.

3. **`packages/database/tsconfig.json` was missing a project reference to
   `packages/domain` — a preexisting bug from Phase 2, invisible until this session.**
   Surfaced only when Positions' `GET` endpoints returned a raw Prisma-shaped type
   (including an extra `currency` field that only exists in the Postgres column, not
   in the domain `Position` type) instead of the expected domain `Position[]`.
   Root cause: without the reference, `packages/database`'s own declaration-file
   emission couldn't portably name the `Position` type imported from
   `@trading/domain`, so `tsc` fell back to inlining the Prisma-generated structural
   shape instead. This had presumably been silently "working" for every other entity
   only because their Prisma and domain shapes happened to coincide closely enough
   not to expose the mismatch. Fixed by adding
   `{ "path": "../domain" }` to `packages/database/tsconfig.json`'s `references`.
   **This is a more serious, general finding than #1:** it means the *first* project
   reference fix (item 1, in `apps/api`) was necessary but not sufficient — a package
   can have a correct reference itself and still emit incorrect declarations for its
   *consumers* if one of *its own* dependencies is unreferenced. Every composite
   package's `tsconfig.json` needs its own references audited, not just the
   top-level consumer.

4. **Stale `dist/` and `.tsbuildinfo` caused a "has no exported member" error for a
   genuinely-correctly-exported symbol (`calculatePositionAfterTransaction`).** After
   fix #3 above, `apps/api`'s `tsc --noEmit` (composite mode, using `references`)
   was reading `packages/domain/dist/index.d.ts` — a stale compiled output that
   predated the new `calculations/position-recalculation.ts` module — instead of the
   live `src/index.ts`. Confirmed by reading both files directly: the live source was
   correct, the compiled `.d.ts` was missing the new export line entirely. The
   initial cleanup attempt (`rm -rf dist *.tsbuildinfo`) failed silently because `rm`
   is not a native PowerShell command; `Remove-Item -Recurse -Force ... -ErrorAction
   SilentlyContinue` is the correct equivalent on this machine. Resolved by deleting
   `dist/`/`*.tsbuildinfo` for both `packages/domain` and `apps/api`, then explicitly
   recompiling domain (`pnpm --filter @trading/domain exec tsc` — **note:**
   `packages/domain` has no `build` script defined, only `typecheck`/`test`; see open
   item in §8). **Durable lesson:** any time a new export is added to a composite
   package that others depend on via `references` + `tsc --noEmit` (not
   `tsc --build`), that package's `dist/` must be explicitly recompiled before the
   consumer will see the new export — saving the source file alone is not enough,
   and this is easy to miss because `tsc --noEmit` gives no indication it's reading
   stale compiled output rather than live source.

5. **Prisma Studio silently showed all tables as empty after a real, successful
   `db:seed` run.** The seed script's own console output clearly listed real inserted
   IDs (3 portfolios, 7 assets, 1 user, etc.), directly contradicting what Studio
   displayed. Root cause: `prisma migrate dev` had thrown an `EPERM: operation not
   permitted, rename ... query_engine-windows.dll.node.tmp... -> query_engine-
   windows.dll.node` error immediately before the seed ran — a Windows file-lock
   issue (almost certainly Prisma Studio or a running `tsx watch` process holding the
   query engine binary open) that left the generated Prisma Client in a
   partially-regenerated state. Diagnosed independently of Prisma entirely by
   connecting directly with `psql` inside the running Postgres container
   (`docker exec -it trading-analytics-postgres psql -U trading_user -d
   trading_analytics_dev`) and querying the actual table names directly — which also
   surfaced a second, smaller finding: **Prisma's `@@map()` means the real Postgres
   table names are `snake_case` plural (`portfolios`, `positions`, `users`, ...), not
   the PascalCase singular model names (`Portfolio`, `Position`, `User`) used in
   `schema.prisma` and in TypeScript** — querying `SELECT * FROM "Portfolio"` against
   raw Postgres fails with `relation does not exist`; the correct query targets
   `portfolios`. **Not resolved this session** (Studio itself was never fixed — see
   open item in §8) but fully bypassed: the seed's own console output already
   contained every ID needed to continue testing (see §5.6 below), and `psql`
   independently confirmed the data was correct all along.

6. **PowerShell quoting for `psql -c "..."` one-liners failed twice in a row** with
   different symptoms each time — first `unterminated quoted identifier` (nested
   double-quotes inside a double-quoted `-c` argument being interpreted by
   PowerShell itself before reaching `docker exec`), then `relation "Portfolio" does
   not exist` (once outer single-quotes fixed the first problem, but the identifier
   itself was still the wrong PascalCase name — see #5 above). This is the same
   general class of shell-escaping friction already documented for `curl.exe` in an
   earlier session. **Established going forward for this project:** for any
   multi-layered-quoting `psql`/`docker exec` one-liner, prefer opening an
   **interactive** `psql` session first (`docker exec -it ... psql -U ... -d ...`
   with no `-c` at all) and typing the SQL directly at the `psql` prompt — this
   sidesteps PowerShell's quoting rules entirely and was what actually got a usable
   result this session.

7. **Login failed with `INVALID_CREDENTIALS` because the assistant guessed the seed
   user's email (`demo@example.com`) instead of reading the actual seed data file.**
   The real seeded demo credentials, confirmed by reading
   `packages/database/src/seed/data/user.ts` and `.../data/credential.ts` directly,
   are:
   ```text
   email:    demo@trading-analytics.dev
   password: demo1234
   ```
   **Durable lesson, reinforcing the project's own standing hard rule:** never state
   a credential, ID, or any other concrete seed value from memory or assumption —
   always read the actual seed data file first, even for something that feels like
   it should be a stable, memorable constant. This file is worth linking directly
   from this PROGRESS.md going forward (see §6) so the next session doesn't repeat
   the same wrong guess.

**Lesson reinforced (fifth session running):** reading the actual file content via
the filesystem MCP immediately before diagnosing anything — not just before editing —
is what actually resolved items #3, #4, #5, and #7 above. Every one of them would have
produced a plausible-but-wrong diagnosis if addressed from the error message or from
memory alone instead of the real file/database state.

---

## 6. How to Resume From Here

1. Read this file in full.
2. Use the filesystem MCP to independently verify current repo state — in particular:
   - Confirm `apps/api/src/services/`, `.../schemas/`, `.../routes/` contain
     `portfolio.*`, `position.*`, and `transaction.*` files matching the trees in §3
     above.
   - Confirm `packages/domain/src/calculations/position-recalculation.ts` and its
     `.test.ts` exist, and that `packages/domain/src/index.ts` exports them.
   - Confirm `packages/domain/src/value-objects/money.ts` has a `divide()` method.
   - Confirm both `apps/api/tsconfig.json` and `packages/database/tsconfig.json` have
     `references` arrays that include `packages/domain` (this was the source of two
     separate real bugs this session — see §5 items 1 and 3 — and is exactly the kind
     of thing that could silently regress if a tsconfig gets regenerated or merged
     carelessly later).
3. Confirm local repo state: `git status`, `git branch --show-current`,
   `git log --oneline -30`.
4. Confirm Docker Postgres is running: `docker compose ps`.
5. **Before trusting Prisma Studio for anything**, be aware it was left in a broken
   state this session (see §5 item 5, §8). If it's still broken, use a real
   Postgres client instead — TablePlus, DBeaver, pgAdmin, or `psql` directly all work
   fine and don't depend on Prisma's generated client at all. Connection details:
   ```text
   Host:     localhost
   Port:     5432
   User:     trading_user
   Password: trading_dev_password
   Database: trading_analytics_dev
   ```
   (from `.env`'s `DATABASE_URL` — confirm it hasn't changed before trusting this).
6. **Demo login credentials** (do not guess — confirmed by reading
   `packages/database/src/seed/data/user.ts` and `.../data/credential.ts` this
   session):
   ```text
   email:    demo@trading-analytics.dev
   password: demo1234
   ```
7. Recompile `packages/domain` explicitly before running `apps/api`'s typecheck if
   any domain file has changed since the last recompile (see §5 item 4 — there is no
   `build` script yet, so run):
   ```bash
   pnpm --filter @trading/domain exec tsc
   ```
8. Sanity-check the stack still works end-to-end before building anything new: start
   `apps/api` in dev mode, log in with the credentials in §6.6, and hit
   `GET /api/v1/portfolios` with the returned token.
9. **Decide the next phase direction first** (see §2 — this was deliberately left
   open, not decided, at the end of this session): continue backend-first (Assets API
   next, per the strict phase order) or pivot to Phase 5 (Frontend Foundation) to get
   the demo experience running sooner, per the project's stated priority (rule 7).
   Propose this as the very first question of the next session rather than assuming
   an answer.

---

## 7. Last Relevant Commits (this session, chronological)

```
feat(portfolio): add portfolio application service
feat(api): add GET /api/v1/portfolios endpoint scoped to authenticated user
fix(api): add missing project reference to packages/domain in apps/api tsconfig
fix(api): use conditional spread for optional description under exactOptionalPropertyTypes
feat(api): add centralized mapping of domain Invalid*Error to 400 VALIDATION_ERROR
feat(portfolio): add createPortfolio to portfolio service
feat(api): add POST /api/v1/portfolios endpoint
feat(api): add updatePortfolioRequestSchema restricted to name and description
feat(portfolio): add updatePortfolio with ownership-aware 404 and immutable baseCurrency
feat(api): add PATCH /api/v1/portfolios/:portfolioId endpoint
fix(portfolio): rebuild update input via conditional spread to satisfy exactOptionalPropertyTypes
feat(portfolio): add archive endpoint with idempotent status transition
feat(position): add read-only positions endpoints with derived metrics
fix(database): add missing project reference to packages/domain in tsconfig
feat(transaction): add transaction endpoints with synchronous position recalculation
```

Exact order/squashing at merge time is a decision for the next PR review, not fixed
here.

---

## 8. Open Items / Pending Decisions

Carried over from previous sessions (all still non-blocking, untouched this session):
Prisma major version deferral, branch-source enforcement on `main`, GitHub default
branch, `packages/database`'s `typescript` devDependency version lag,
Watchlist/UserPreference/MarketPrice/MarketEvent seed tables still intentionally
unseeded, the cosmetic `"details":[]` instead of omitted key in error bodies, no
`requireRole()` yet, no registration endpoint, no refresh tokens. See prior
PROGRESS.md revisions if any of these need to be revisited.

**New this session:**

- **8.14 — No `build` script in `packages/domain` or `packages/database`
  `package.json`** (only `typecheck`/`test` exist). This was the direct cause of
  needing the less-discoverable `pnpm --filter @trading/domain exec tsc` workaround
  in §5 item 4. Adding `"build": "tsc"` (or `"build": "tsc --build"`) to both
  packages was proposed and explicitly deferred by the user as a DX improvement, not
  resolved this session. Low effort, worth doing early next session before it causes
  the same confusion again.

- **8.15 — `createTransaction`'s steps 4-6 (persist transaction, recalculate
  position, mark COMPLETED) are not wrapped in a single database transaction.**
  Explicitly flagged in code comments and in §4 above. A failure between persisting
  the transaction and finishing the position update could leave a `Transaction`
  stuck in `DRAFT` with no corresponding `Position` change — a real, if currently
  unlikely, data-consistency gap against `NFR-074`. Deferred by explicit user
  agreement ("anotalas y sigamos") rather than resolved. Should be revisited with
  Prisma's `$transaction` once other Transactions-adjacent work (Assets API, or
  frontend integration) has had a chance to exercise this endpoint more.

- **8.16 — Prisma Studio was left in a broken/stale state** (see §5 item 5) — never
  explicitly fixed, only bypassed via direct `psql` access. If Studio is needed again
  next session, the likely fix is: stop all running Node/Prisma processes (dev
  server, any other Studio instance), run `pnpm --filter @trading/database
  db:generate` cleanly with nothing else holding the query engine binary open, then
  restart Studio.

- **8.17 — No `GET /api/v1/assets` (or any Assets API) exists yet.** This session had
  to read asset IDs directly from `db:seed`'s console output / a raw `psql` query
  instead of hitting a real endpoint, because nothing in `apps/api/src/routes/`
  covers Assets. This is a real, concrete gap for whichever direction is chosen next
  (see §2) — the frontend's transaction-creation form will need this regardless, and
  it's also required by `07-api-spec.md` §17 for the product itself.

- **8.18 — Optional-property + `exactOptionalPropertyTypes` friction (§5 item 2)
  has now recurred at least three times across two sessions** (once in
  `error-handler.ts` previously, twice more this session). The conditional-spread
  pattern works but is easy to forget at a new boundary. Worth considering, as a
  future low-priority improvement, a small shared helper (e.g. a `compact()` utility
  that strips `undefined` values from an object) if this keeps recurring — not
  proposed or built this session, just noted as a pattern worth watching.
