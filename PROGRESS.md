# PROGRESS.md

**Project:** Trading Analytics Platform
**Last updated:** Phase 1 in progress — API backend functionally complete, hardening underway
**Current branch context:** `develop` (verify against `git status`/`git log` before resuming)

> This file is the source of truth for resuming work across chat sessions.
> Do not rely on assistant memory — read this file first, then the relevant
> SDD documents in `docs/`, then `CONTRIBUTING.md` for workflow rules.

---

## 1. Current Phase / Step

**Phase 0 — Repository Foundation: ✅ COMPLETE**

**Phase 1 — Product and Domain Foundation: ✅ substantially complete**

- [x] `packages/domain` — full domain layer: entities, value objects (`Money`),
      enums, and financial calculations (allocation, attribution, drawdown,
      volatility, scenario-impact, portfolio-metrics, position-metrics,
      portfolio-pulse, position-recalculation). Every entity and calculation
      has a corresponding `.test.ts`.
- [x] `packages/database` — Prisma schema + migrations, a repository per
      entity (`Prisma*Repository`, 13 repositories), a unit-of-work
      implementation, mappers, and a seed script. Every repository has a
      corresponding `.test.ts`.
- [x] `apps/api` — Express 5 REST API covering 8 domains (auth, portfolios,
      positions, transactions, assets, analytics, overview, health).

**Phase 1.5 — API hardening (not in the original phase breakdown, done
opportunistically alongside a controller refactor):**

- [x] Routes refactored into `route → validate? → controller → service`
      layers, consistently across all 8 domains (previously routes mixed
      validation, orchestration, and response handling inline).
- [x] Generic `validate(schema, source)` middleware replacing per-route
      inline `safeParse` + `AppError` construction.
- [x] Rate limiting: `generalApiRateLimiter` (300 req/15min, global) and
      `loginRateLimiter` (5 req/15min, `/api/v1/auth/login` only, stacked
      on top of the general limiter) — mitigates brute-force/credential
      stuffing against login and general API abuse.
- [x] `helmet()` for security headers and `cors()` scoped to an
      allowlisted, env-configurable origin (`CORS_ORIGIN`, defaults to
      `http://localhost:5173` since `apps/web` doesn't exist yet).
- [x] Root `test` script (`pnpm -r test`) added to run every package's
      Vitest suite from one command.

**What has NOT been started:**

- `apps/web` — still an empty placeholder (`.gitkeep` only). No frontend
  code, no framework choice implemented yet.
- `packages/contracts` and `packages/config` — still empty placeholders.
- CI (`.github/workflows/`) — not yet created.
- No test suite exists for `apps/api` itself (routes/controllers/services)
  — all current test coverage is in `packages/domain` and
  `packages/database`.

This is an intentional, acknowledged state: the project is deliberately
staying backend-only during this phase, with CI and frontend deferred
until there's a stable API surface and contracts worth building a
pipeline/UI against.

---

## 2. What's Been Implemented

### Repository & tooling

- Same as Phase 0 (pnpm monorepo, strict TS base config, ESLint/Prettier/
  Husky) — see git history for exact commits.
- Root `package.json` scripts: `build`, `test`, `typecheck`, `lint`,
  `lint:fix`, `format`, `format:check`.

### `packages/domain` (`@trading/domain`)

- Entities: `alert`, `asset`, `credential`, `decision`, `decision-event`,
  `historical-price`, `market-event`, `market-price`, `notification`,
  `portfolio`, `position`, `scenario`, `transaction`, `user`,
  `user-preference`, `watchlist-item` — each with domain validation and a
  `.test.ts`.
- Value objects: `Money` (in `value-objects/`).
- Calculations (`calculations/`): `allocation`, `attribution`, `drawdown`,
  `portfolio-metrics`, `portfolio-pulse`, `position-metrics`,
  `position-recalculation`, `scenario-impact`, `volatility`.
- Framework-agnostic: no Express/Prisma dependency, testable in isolation
  (per NFR-042/NFR-043).

### `packages/database` (`@trading/database`)

- Prisma schema + migrations under `prisma/`.
- `PrismaUnitOfWork` (`prisma-unit-of-work.ts`).
- One Prisma-backed repository per entity under `repositories/`
  (`Prisma*Repository`), each with a `.test.ts`.
- Mappers (domain entity ⇄ Prisma model) under `mappers/`.
- Seed script (`prisma/seed.ts`, `src/seed/`).

### `apps/api` (`@trading/api`)

Express 5 app (`src/index.ts`), middleware chain in order:
`helmet → cors → requestId → generalApiRateLimiter → express.json() →
[routes] → 404 handler → errorHandler`.

- **Middleware** (`src/middleware/`): `authenticate` (JWT bearer, generic
  401 for every failure mode to avoid leaking which check failed),
  `validate` (generic Zod-schema validation for query/body, populates
  `req.validated`), `rate-limit` (`generalApiRateLimiter`,
  `loginRateLimiter`), `request-id` (assigns/propagates `X-Request-ID`),
  `error-handler` (normalizes `AppError`, domain `Invalid*`/
  `Insufficient*Error`, and unexpected errors into one response shape).
- **Config** (`src/config/env.ts`): Zod-validated env (`PORT`,
  `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS`, `CORS_ORIGIN`), fails fast on
  invalid config at startup.
- **Routes** (`src/routes/`): one file per domain
  (`analytics`, `assets`, `auth`, `health`, `overview`, `portfolios`,
  `positions`, `transactions`) — each is now a pure routing table:
  method + path + middleware chain, no inline logic.
- **Controllers** (`src/controllers/`): one file per domain, holding the
  actual request-handling logic previously inlined in the routes.
- **Services** (`src/services/`): one file per domain
  (`analytics`, `asset`, `auth`, `health`, `overview`, `portfolio`,
  `position`, `transaction`) — orchestrates domain logic + repositories.
- **Schemas** (`src/schemas/`): Zod request-boundary validation per
  domain, plus shared `pagination.schema.ts`.
- **Errors** (`src/errors/app-error.ts`): `AppError` with a fixed
  `AppErrorCode` union (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`,
  `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `TIMEOUT`, `DEPENDENCY_ERROR`,
  `INTERNAL_ERROR`).

### Documentation

- All 16 SDD documents (`00-overview.md` through `15-implementation-plan.md`)
  under `docs/`.

---

## 3. Key Decisions Made (and why)

Phase 0 decisions (git workflow, PR discipline, TypeScript/ESLint pinning)
are unchanged — see prior version of this file / git history if needed.

Decisions from Phase 1 / Phase 1.5:

| Decision                                                                                                                   | Reason                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Routes hold no logic** — `route → validate? → controller → service` in every domain, no exceptions (including `health`)  | Consistency: one pattern to learn for the whole `src/` tree, easier to test controllers in isolation from Express wiring.                                                                                                           |
| **`validate` middleware stores parsed data on `req.validated.{query,body}` instead of overwriting `req.query`/`req.body`** | Express's built-in types for `req.query`/`req.body` are narrower than a Zod schema's parsed output (coerced numbers, applied `.default()`); writing through a separate property avoids fighting the type system at every call site. |
| **`health` got its own `services/health.service.ts`** (`checkDatabaseConnection`) instead of just a controller             | It was the only route hitting Prisma directly, breaking the `route → controller → service` layering everywhere else. Fixed for consistency, not because of a bug.                                                                   |
| **Two separate rate limiters** (`generalApiRateLimiter` global, `loginRateLimiter` stacked on login only)                  | Login needs a much tighter ceiling (brute-force/credential-stuffing target) than general API traffic; stacking both means a malformed-body login attempt still counts against the login limiter even before `validate` runs.        |
| **In-memory store for rate limiting (no Redis)**                                                                           | Single API instance today; revisit with an external store only if/when the API is horizontally scaled — documented in `middleware/rate-limit.ts` so it isn't forgotten.                                                             |
| **`CORS_ORIGIN` defaults to `http://localhost:5173`**                                                                      | Typical local Vite dev port — `apps/web` doesn't exist yet, so there's no real origin to allowlist yet. Must be revisited once the frontend's actual dev/prod origin(s) are known.                                                  |
| **CI, `apps/web`, `packages/contracts` deliberately deferred**                                                             | Explicit project-owner decision: still in active backend development; CI and frontend work will start once the API surface is considered stable enough to build a pipeline/UI against.                                              |

**No deviations from the product/architecture SDDs (00–15)** — all Phase 1
work follows `docs/05-data-model.md` and `docs/07-api-spec.md` for shape,
and `docs/09-security-spec.md` for the security decisions above.

---

## 4. Relevant Structure So Far

```text
trading-analytics-platform/
├── .github/
│   └── PULL_REQUEST_TEMPLATE.md          (no workflows yet — CI deferred)
├── .husky/
│   └── pre-commit
├── apps/
│   ├── web/                              (empty, .gitkeep — not started)
│   └── api/
│       └── src/
│           ├── config/       (env.ts)
│           ├── controllers/  (one per domain, 8 files)
│           ├── errors/       (app-error.ts)
│           ├── middleware/   (authenticate, validate, rate-limit,
│           │                  request-id, error-handler)
│           ├── routes/       (one per domain, 8 files — pure routing)
│           ├── schemas/      (Zod schemas per domain + pagination)
│           ├── services/     (one per domain, 8 files)
│           └── index.ts
├── packages/
│   ├── contracts/            (empty, .gitkeep — not started)
│   ├── config/                (empty, .gitkeep — not started)
│   ├── domain/
│   │   └── src/
│   │       ├── calculations/ (9 calculation modules + tests)
│   │       ├── entities/     (16 entities + tests)
│   │       ├── repositories/ (repository interfaces)
│   │       └── value-objects/ (Money + test)
│   └── database/
│       ├── prisma/           (schema.prisma, migrations/, seed.ts)
│       └── src/
│           ├── mappers/
│           ├── repositories/ (13 Prisma*Repository + tests)
│           ├── seed/
│           ├── client.ts
│           └── prisma-unit-of-work.ts (+ test)
├── docs/
│   └── 00-overview.md ... 15-implementation-plan.md   (all 16 present)
├── docker/
├── docker-compose.yml        (postgres only — no api/web containers yet)
├── .env.example
├── package.json               (scripts: build, test, typecheck, lint,
│                                lint:fix, format, format:check)
├── pnpm-workspace.yaml
├── CONTRIBUTING.md
└── README.md
```

---

## 5. Last Relevant Commits (on `develop`)

Not tracked exhaustively in this file anymore given the volume of commits
since Phase 0 — run `git log --oneline` on `develop` to see the real
history. Notable recent work (see actual commit messages via git log):

- Controller/route separation refactor across all 8 `apps/api` domains
  (one commit per domain, `refactor(api): extract <domain> controller ...`).
- `health` moved to its own service layer
  (`refactor(api): extract health controller and service layer`).
- Rate limiting added (`feat(api): add rate limiting for login and
general API traffic`).
- Helmet + CORS added (`feat(api): add helmet security headers and CORS
with configurable origin`).
- Root `test` script added.

---

## 6. Next Concrete Step

No single next step is mandated — the project owner is intentionally
staying in backend-focused development. Reasonable next candidates,
in the order they were discussed (not necessarily the order to do them):

1. **Test coverage for `apps/api` itself.** Currently zero tests exist for
   routes/controllers/services in `apps/api` — all coverage is in
   `packages/domain` and `packages/database`. Given controllers are now
   isolated from Express wiring (per the refactor above), this is cheaper
   to add now than before.
2. **CI pipeline** (`install → typecheck → lint → test → build`) — explicitly
   deferred by the project owner, revisit when ready.
3. **`apps/web`** — explicitly deferred, no frontend framework decision
   made yet.
4. **`packages/contracts`** — natural home for DTOs shared between `api`
   and `web` once the frontend starts; still empty.
5. Housekeeping noted but not actioned: no `Dockerfile` for `apps/api`
   yet (only Postgres is containerized); revisit once a deploy target is
   chosen (`14-deployment-spec.md`).

---

## 7. Open Items / Pending Decisions

Carried over from Phase 0 (still open, not revisited):

- **Branch source enforcement for `main`**: a GitHub Actions check that
  fails PRs into `main` not sourced from `develop` — deferred until real
  CI exists.
- **GitHub default branch**: still `main`; considered switching to
  `develop` temporarily, left open.

New from Phase 1 / 1.5:

- **`CORS_ORIGIN` default is a guess** (`http://localhost:5173`) — must be
  revisited once `apps/web`'s real dev/prod origin(s) are decided.
- **Rate limiting uses an in-memory store** — fine for a single instance;
  would need an external store (e.g. Redis) if the API is ever scaled
  horizontally. Not urgent today.
- **No test suite for `apps/api`** — see Next Concrete Step #1.

---

## 8. How to Resume From Here

1. Read this file in full.
2. Confirm current local state matches this file: `git status`,
   `git branch`, `git log --oneline -10` on `develop`.
3. Skim `docs/09-security-spec.md` if resuming security-adjacent work
   (rate limiting, CORS, auth), or `docs/07-api-spec.md` if resuming
   route/controller work.
4. If picking up "Next Concrete Step" #1 (API test coverage), check
   `docs/10-testing-strategy.md` for the expected testing approach before
   proposing a plan.
5. Follow the same working agreement used throughout: small steps,
   explicit approval before each file change, verify via
   `pnpm build`/`pnpm lint`/`pnpm test` after each change, then commit
   with a `prefix(scope): description` message (English, ≤99 chars) before
   moving to the next step.
