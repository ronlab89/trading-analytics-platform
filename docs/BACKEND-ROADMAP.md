# Backend Completion Roadmap

> **Superseded in part (2026-10-04).** The architecture decision records in
> `docs/adr/` take precedence over this file. A new block **B0** (application
> layer and shared contracts, ADR-001 and ADR-002), preceded by minimal CI
> (ADR-006), comes before B1. The open decisions listed for B1 to B5 are
> settled by ADR-003 to ADR-009. This file is rewritten in Phase 5 of
> `odd/tasks/sdd-source-of-truth.md`.

**Purpose:** the ordered path to finish the whole backend before starting
the frontend and the public demo. This is a working plan, not a
specification: the SDD (`00`-`15`) stays the source of truth for behavior,
`PROGRESS.md` records what is done and why, and this file says what is
left, in what order, and when each block counts as closed.

**Last updated:** 2026-10-03
**Decision behind it:** the user chose to finish the backend completely
before starting the frontend (the plan's rule 11 would prefer the demo
first; this is a deliberate override).
**Evidence base:** `PROGRESS.md`, the SDD, and a direct check of the code
on 2026-10-03: `apps/api` route and service tree, `apps/api/package.json`,
`schema.prisma`. Items marked *(unverified)* were not checked in code.

---

## 1. Where the backend stands

Done and covered by tests (details in `PROGRESS.md`): auth login and `me`,
portfolios, positions, transactions (synchronous, atomic through
`UnitOfWork`), assets, market prices and history, allocation and
attribution, overview (with `dailyChange` and `pulse`), watchlist, alerts,
notifications, preferences, decisions (read and replay), scenarios (full,
with calculate and compare). Cross-cutting: request IDs, a normalized
error contract, validation, rate limiting, helmet and CORS, health and
readiness, two separate databases (dev and test).

Checked on 2026-10-03 and **absent**:

| Area | Evidence |
|---|---|
| Logout endpoint | `auth.routes.ts` only has `login` and `me` |
| Performance, risk and pulse endpoints | `analytics.routes.ts` only has `allocation` and `attribution` |
| Role enforcement | no `requireRole`; `authenticate` only |
| Logger | no logger module; `index.ts` uses `console.log`; no logging dependency in `package.json` |
| Metrics | none |
| Graceful shutdown | `index.ts` is `createApp()` plus `listen()` |
| WebSocket / realtime | no server, no dependency |
| Background jobs | no table in `schema.prisma`, no routes |
| Idempotency keys | none |
| OpenAPI | no generator or document |
| Production build | `PROGRESS.md` §7: `@trading/domain` and `@trading/database` point `main` at `src` |

---

## 2. Definition of "backend done"

All of the following, then the frontend can start:

1. Blocks B1 to B7 below are closed against their own "Done when".
2. The verification loop passes: `pnpm typecheck`, `pnpm lint`, and the
   domain, database and api test suites.
3. Every deliberate divergence from the SDD is reflected in the SDD.
4. `PROGRESS.md` is current.
5. The handoff artifacts for the demo exist (section 6).

---

## 3. The blocks, in order

Order reasoning: B1 is a P0 requirement with no dependencies. B2 is small
and closes security before more surface is added. B3 comes before
Realtime and Jobs because those are the hardest to debug blind (the plan
puts observability at Phase 13; it is pulled forward on purpose). B4
before B5 because job progress is a realtime event. B6 documents the final
surface. B7 prepares deployment.

Each block follows the usual method: read the real code and the specs
first, propose small slices, wait for approval, apply, verify, commit.

### B1. Portfolio performance and risk analytics

**Why first:** FR-025 (portfolio performance by period) is **P0** and is
the only P0 product requirement the backend still lacks. The dashboard
needs it. It is pure domain work with no dependencies.

**Scope**
- Domain: reconstruct a portfolio value time series from `Transaction[]`
  and `HistoricalPrice` (daily candles). This is the piece
  `PROGRESS.md` already flags as the reason `overview.performance` is
  missing.
- Performance by period (FR-025/026) from that series.
- Portfolio-level drawdown and volatility (FR-028/029). Today
  `calculateDrawdown` and `calculateVolatility` work on a single asset's
  series; reuse them if the series shape allows.
- API: `GET /portfolios/:id/analytics/performance`,
  `GET .../analytics/risk`, and `GET .../pulse` as its own endpoint
  (`07-api-spec.md` §20-22). Add `performance` to the overview.
- Pulse today uses the largest position as a proxy for volatility and
  drawdown; with a real portfolio series it can use the real values.
- Attribution `from`/`to`/`groupBy` (`07-api-spec.md` §22).

**Open decisions (need the user)**
1. **Return methodology.** The portfolio has only `BUY` and `SELL` and no
   cash balance. Buying adds value without being a return, so a naive
   "value now vs value then" is wrong. Options: time-weighted return (daily
   cash-flow adjusted), simple change on invested capital, or both. This
   is the central design question of the block.
2. **Supported periods and what `1D` means** when only daily candles exist
   (last close vs previous close, as `MarketPrice` already does).
3. **Days without prices**: skip, carry the last price forward, or fail
   with `InsufficientDataError` (the codebase's usual distinction between
   "insufficient data" and "valid empty state").
4. **Sector grouping**: no sector data exists (`Asset.metadata` is free
   JSON). Keep deferred unless the metadata shape is defined.

**Done when:** hand-computed unit tests for the series and each metric;
integration tests for the three endpoints and the overview field; no
fabricated numbers anywhere (absent or `UNKNOWN` instead); `07-api-spec.md`
§20-22 reconciled; the missing overview integration test for `dailyChange`
and `pulse` added while the overview is being touched.

**Size:** large.

### B2. Authentication and RBAC

**Scope**
- `POST /auth/logout` (FR-003, P0; `07-api-spec.md` §9).
- A role and permission model and a `requireRole` / permission middleware
  (`09-security-spec.md` §12-17), applied to the existing routes where it
  makes sense.
- Token strategy decisions (below), including token lifetime.
- User registration is **not in the spec** (`07-api-spec.md` §9 defines
  login, `me` and logout only). Treat it as optional.
- Auth security events (`09-security-spec.md` §50) are emitted through the
  logger once B3 exists; B2 does not need to wait for it.

**Open decisions (need the user)**
1. **Role names.** The SDD contradicts itself (section 5, item 1). The
   code today is `USER` and `ADMIN`.
2. **What each role may do.** No admin-only endpoint exists today, so RBAC
   would otherwise protect nothing. A permission matrix is needed, even a
   small one (for example a read-only role).
3. **Token transport.** Today: `Authorization: Bearer`. `09-security-spec.md`
   §8 prefers HttpOnly cookies, which then require CSRF protection (§23).
4. **Logout semantics** with stateless JWTs: client-side discard only, a
   server-side denylist, or refresh-token revocation. Whether to have
   refresh tokens at all (§7).
5. Registration: in or out.

**Done when:** authorization tests cover allowed role, denied role,
cross-user access and escalation attempts (`09-security-spec.md` §55);
logout behavior is tested for the chosen semantics; the SDD role model is
reconciled.

**Size:** small to medium, depending on decisions 3 and 4.

### B3. Observability foundation

**Scope**
- A logger abstraction, not tied to a vendor (`13-observability-spec.md`
  §33), with structured output, levels, stable event names, and
  sanitization of sensitive fields (§11).
- Replace `console.log`; log per request with `requestId`; classify errors
  in the error handler (§12-13).
- HTTP metrics with bounded labels and a guarded `/metrics` (§16-17, §49).
- Slow-operation diagnostics (§53). Hooks the later blocks will use for job
  and realtime lifecycle events (§43, §28).

**Open decisions:** logger library (the stack names none) and metrics
format (hand-rolled in-memory counters or a Prometheus client).

**Done when:** the unit and integration tests in `13-observability-spec.md`
§59-62 exist; request correlation is verified from request to log;
sensitive fields never reach a log; a developer can answer the ten
questions in §75 for a reproduced failure.

**Size:** medium.

### B4. Background jobs and idempotency

**Scope**
- A `jobs` table (a new migration; none exists), job states
  `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` (plus timeout,
  per the plan), progress, retry, cancellation, timeout.
- `GET /jobs/:jobId`, `POST /jobs/:jobId/retry` (`07-api-spec.md` §15-16).
- `Idempotency-Key` support for state-changing operations such as
  transaction creation (`07-api-spec.md` §39, NFR-016).
- Lifecycle events through the logger (B3).

**Open decisions (need the user)**
1. **What actually runs as a job.** Nothing needs it today: transactions
   are synchronous by design. Candidates: asynchronous transaction
   processing (§14 says "may be"), analytics recalculation, report or
   export generation. Building a job system with nothing to run on it would
   break NFR-070, so this must be settled before any code.
2. In-process runner backed by the table (recommended start) versus a
   separate worker (the plan says not initially).
3. Whether jobs survive a restart.

**Done when:** state-transition tests including failure, timeout and
retry; idempotency tests for duplicate submissions; graceful behavior of
in-flight jobs on shutdown (shares work with B7).

**Size:** medium to large, driven by decision 1.

### B5. Realtime

**Scope** (`08-realtime-spec.md`, FR-044 to FR-053)
- WebSocket server behind a transport abstraction (a new dependency,
  chosen with the user), authentication on connect, channel authorization
  (`portfolio:{id}`, `market:{assetId}`, `jobs:{id}`,
  `notifications:{userId}`).
- Typed, validated event envelope with sequence numbers. `MarketEvent`
  already has a `sequence` column.
- A server-side price source. There is no paid provider, so the real
  backend needs a market-data adapter backed by a simulator
  (`04-tech-stack.md` §47-48).
- Notification producers (transaction completed, alert triggered, job
  events) and alert evaluation without repeated alerts on every tick
  (FR-053, `12-demo-mode-spec.md` §45).
- Resynchronization through HTTP, subscription limits, bounded memory,
  rate protection (`08-realtime-spec.md` §25-26, §47-51;
  `09-security-spec.md` §31-35).

**Open decisions (need the user)**
1. **Where the simulation engine lives.** The demo needs the same
   deterministic engine in the browser (`12-demo-mode-spec.md` §36-40).
   Building it once as a shared package, used by both this server and the
   demo, avoids two diverging copies. This decision shapes the frontend
   work and should be made here.
2. WebSocket library.
3. Which events ship in the first version (`08-realtime-spec.md` §15
   lists eleven).

**Done when:** connection, auth, subscription, ordering, duplicate and
stale-event, reconnect and unauthorized-channel tests
(`08-realtime-spec.md` §59); notifications and alerts generated by real
events; realtime failure degrades to HTTP.

**Size:** large. Plan it as several slices, starting with the transport
alone (`15-implementation-plan.md` §14 recommends exactly that order).

### B6. API documentation and contract

**Scope**
- An OpenAPI document covering every endpoint, the error schema,
  authentication and examples (`04-tech-stack.md` §21,
  `07-api-spec.md` §57). Zod v4 can emit JSON Schema, which may avoid a
  second source of truth; to be confirmed when the block starts.
- The foundation for contract tests: the same schemas that validate the
  real API must be usable to validate the demo's mock adapters
  (`07-api-spec.md` §56, `10-testing-strategy.md` §52).

**Why here:** it documents the final surface, so it waits until B1 to B5
have added their endpoints. It must be done before the frontend, because
the demo's mocks are checked against it.

**Done when:** every route is documented, the document is generated from
code (not hand-maintained), and a test fails when a route and its schema
drift apart.

**Size:** medium.

### B7. Deployment readiness and hardening

**Scope** (`14-deployment-spec.md`, backend side)
- Fix the production build path (`PROGRESS.md` §7).
- API Dockerfile (multi-stage, non-root), a full-stack compose,
  migration-deploy step, separation of dev seed from any deployed data.
- Graceful shutdown (`14-deployment-spec.md` §16).
- Security checklist (§78): secrets, CORS, headers, error exposure, health
  output, resource limits.
- Known debts that belong here: concurrency on position recalculation and
  the unescaped `%`/`_` in search filters (`PROGRESS.md` §7).
- Smoke test definition (§49). Backups are documented, not claimed.

**Note:** CI was deliberately decided against for now (`PROGRESS.md` §7).

**Done when:** a production build runs from a clean checkout in a
container, shutdown drains in-flight work, and the checklist is ticked
with evidence.

**Size:** medium.

---

## 4. Small items to fold into the blocks (not separate work)

| Item | Fold into |
|---|---|
| Overview integration test for `dailyChange` and `pulse` | B1 |
| `tokenFor` migration in older tests | B2 |
| Event ordering tiebreaker beyond `timestamp` | B5 (events created in bursts) |
| `ScenarioRepository.updateChanges` has no production caller | decide when the demo mock is written |
| Wildcard escaping in search; position recalculation race | B7 |
| `07-api-spec.md` §14 (async transactions) versus the synchronous implementation | B4 |

---

## 5. Specification inconsistencies to settle

These are contradictions inside the SDD, found while building. Each needs a
decision from the user and an update to the affected documents.

1. **Roles.** Code and `05-data-model.md` §5: `USER`, `ADMIN`.
   `04-tech-stack.md` §24 and `09-security-spec.md` §12: `TRADER`,
   `ANALYST`, `ADMIN`. `12-demo-mode-spec.md` §56: `Viewer`, `Trader`,
   `Admin`. (Blocks B2.)
2. **Cash and transaction types.** `01-product-spec.md` §8 lists Deposit,
   Withdrawal, Fee and Adjustment; `05-data-model.md` §9 limits the initial
   set to `BUY` and `SELL`, and the code does the same. Yet `05-data-model.md`
   §24 has `cashValue` and `12-demo-mode-spec.md` §47 mentions "insufficient
   simulated cash". The portfolio has no cash balance today. This affects
   the B1 methodology decision and the demo's transaction validation.
3. **Token transport.** `09-security-spec.md` §8 prefers HttpOnly cookies;
   the implementation uses a Bearer header. (Part of B2.)
4. **Stale cross-references.** Several documents reference each other by
   old numbers (for example `08-realtime-spec.md` is titled "07",
   `12-demo-mode-spec.md` cites `05-architecture.md` and `06-api-spec.md`,
   `01-product-spec.md` §8 cites `06-data-model.md`). Documentation
   hygiene only; fix each document when it is next touched.

---

## 6. Handoff to the frontend and demo

What the web app and the mock adapters will consume, and what must exist
before starting them:

- **Pure domain functions to share, not rewrite:** `projectDecisionReplay`,
  `compareScenarioImpacts`, `calculateScenarioImpact`, the portfolio and
  position metrics, allocation, attribution, pulse, and the B1 additions.
- **Repository contracts** in `packages/domain`, including the documented
  behaviors a mock must respect (for example the scenario list order and
  `UnitOfWork`).
- **The error contract, pagination shape and response envelopes** from the
  API (documented in B6).
- **The OpenAPI document and contract-test schemas** (B6).
- **The simulation engine** (B5, decision 1).
- **Open frontend-side questions to settle at the start of that phase:**
  where `apps/web` lives in the workspace, how it consumes `@trading/domain`
  (today `main` and `types` point at `src/index.ts`), and the slice order
  (app shell and routing, mock adapters behind the repository contracts,
  then screens).

---

## 7. Deliberately parked (not required to call the backend done)

- Decision write endpoints and the event journal endpoint
  (`PROGRESS.md` §3.7). Revisit with the frontend screen in view.
- Duplicate scenario, FR-041 (P2).
- Expected vs Actual, FR-035 (P2), and global search, FR-054 (P2).
- Transaction types beyond `BUY` and `SELL`, and weekly or monthly history
  intervals. Both are noted as future additions in the SDD or by the user.
- Allocation, risk and exposure in scenario `calculate` (FR-038): only total
  value and unrealized P/L are derivable honestly today. B1 may unlock part
  of it.

---

## 8. How to work through this file

1. At the start of each block, re-verify the evidence against the code
   (this document can go stale) and take the open decisions to the user.
2. Slices stay small and verifiable; no block is implemented in one go.
3. When a block closes: update `PROGRESS.md` (new section, commits, open
   items), reflect any SDD divergence, and mark the block here as done
   with the date.
4. Do not start the frontend until section 2 is satisfied, unless the user
   changes that decision explicitly.

### Status

| Block | Status |
|---|---|
| B1 Performance and risk analytics | Not started |
| B2 Auth and RBAC | Not started |
| B3 Observability foundation | Not started |
| B4 Background jobs and idempotency | Not started |
| B5 Realtime | Not started |
| B6 API documentation and contract | Not started |
| B7 Deployment readiness and hardening | Not started |
