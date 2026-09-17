# PROGRESS.md

**Project:** Trading Analytics Platform
**Last updated:** End of Phase 3 (Steps 1-4 complete) — Phase 3 fully closed. Cutover to
new chat to start Phase 3 continuation: Portfolios endpoint (Option B chosen over
adding RBAC middleware preemptively — see §4).
**Current branch context:** verify with `git status`/`git log` at the start of next
session before trusting this claim, per the recurring lesson from Phases 1 and 2.

> This file is the source of truth for resuming work across chat sessions.
> Do not rely on assistant memory — read this file first, then the relevant
> SDD documents in `docs/`, then `CONTRIBUTING.md` for workflow rules.
>
> **Filesystem MCP access confirmed working** for this project throughout
> this entire session (root: `Internal Projects/trading-analytics-platform`).
> Every file was read directly via this MCP immediately before writing or
> editing anything that depended on it — this remains a hard rule for this
> project (see §6).

---

## 1. Current Phase / Step

**Phase 0 — Repository Foundation:** ✅ COMPLETE
**Phase 1 — Product and Domain Foundation:** ✅ COMPLETE
**Phase 2 — Database and Infrastructure:** ✅ COMPLETE
**Phase 3 — Backend/API Foundation:** ✅ COMPLETE (this session closed it out)

All sub-steps closed:

- [x] Step 1 — Bootstrap `apps/api` (Express + TypeScript, minimal server)
- [x] Step 2 — Base middleware: request ID (native `crypto.randomUUID()`, validated
      allowlist pattern), centralized error handler (`AppError` + normalized JSON shape)
- [x] Step 3 — Health (`GET /health`) and readiness (`GET /health/ready`, real Postgres
      check via `@trading/database`'s `prisma.$queryRaw`) endpoints
- [x] Step 4 — Authentication: JWT + bcryptjs login, JWT verification middleware,
      protected `GET /api/v1/auth/me`

**Phase 3 has no remaining scope as originally planned.** RBAC (role-restriction
middleware) was deliberately deferred — see §4 decision table, last row.

---

## 2. Next Phase / Step

**Immediate next step:** **Option B (chosen this session): move directly to the first
real business endpoint — Portfolios (`GET/POST /api/v1/portfolios`)** — rather than
building a `requireRole()` RBAC middleware with no real consumer yet.

Per `15-implementation-plan.md` §25 (API Implementation Order):
```text
Health -> Auth -> Users/session -> Portfolios -> Positions -> Transactions -> ...
```

Recommended first sub-steps for the next session (not decided yet, to be broken into
small approvable slices as usual):

1. **Confirm current repo state first** (see §6 checklist) — in particular verify
   `apps/api`'s current file tree matches what's documented in §3 below, since this
   session made many small edits both via copy-paste (user) and direct filesystem MCP
   edits (assistant).
2. Review `packages/domain/src/repositories/portfolio-repository.ts` and
   `packages/database/src/repositories/prisma-portfolio-repository.ts` contracts before
   writing any route — do not assume their shape, per the hard rule in §6.
3. Add a `requireAuth`-scoped route: `GET /api/v1/portfolios` (list portfolios owned by
   `req.auth.userId` — this is the first place resource **ownership** enforcement
   (`09-security-spec.md` §14-15, IDOR protection) becomes real and must be implemented,
   not just documented).
4. Then `POST /api/v1/portfolios` (create), following `07-api-spec.md` §10 and the
   validation pipeline in `09-security-spec.md` §18-20 (Zod at the API boundary +
   domain's own `validateNewPortfolio`).
5. RBAC (`requireRole()`) should be introduced later, only when a concrete
   admin-only operation actually needs it — not preemptively (NFR-070).

---

## 3. What's Been Implemented This Session (Phase 3, Steps 1-4)

### 3.1 Step 1 — `apps/api` bootstrap

```text
apps/api/
├── package.json          # @trading/api, type: module, scripts: dev/build/start/typecheck
├── tsconfig.json          # extends ../../tsconfig.base.json, composite: true,
│                           # references: [{ path: "../../packages/database" }]
└── src/
    └── index.ts            # Express app entry point
```

Root `tsconfig.json` updated to add `{ "path": "./apps/api" }` to its `references` array.

**Key TS project-references lesson learned this step:** a composite project (like
`apps/api`) that consumes types from another composite project (`packages/database`)
**must** declare that dependency in its own `references` array, or `tsc --build`
(what `pnpm typecheck` runs at the root) will not reliably resolve those cross-project
types — they'll appear as unresolved/`any` even though a plain `tsc --noEmit` in the
consuming package alone might look fine. This bit us specifically on `prisma.$queryRaw`
in Step 3 and is now documented here so it isn't rediscovered from scratch later.

### 3.2 Step 2 — Base middleware

```text
apps/api/src/
├── errors/
│   └── app-error.ts        # AppError class, AppErrorCode union, AppErrorDetail
└── middleware/
    ├── request-id.ts         # crypto.randomUUID(), validates/allowlists incoming
    │                          # X-Request-ID header instead of trusting it blindly
    └── error-handler.ts        # Centralized handler; must be registered last
```

`index.ts` wires: `requestId` → `express.json()` → routes → explicit 404 (via
`AppError("NOT_FOUND", ...)`) → `errorHandler` (must stay last).

**Key decisions:**
- `crypto.randomUUID()` chosen over `uuid`/`nanoid` — native, zero dependencies,
  cryptographically secure, sufficient for this project's scale (NFR-070).
- Incoming client-supplied `X-Request-ID` is validated against
  `/^[a-zA-Z0-9-]{1,64}$/` before being reused, rather than trusted verbatim — treats
  headers as untrusted external input (`09-security-spec.md` §18).
- `Express.Request` augmented via `declare global { namespace Express { interface
  Request { ... } } }` — **not** `declare module "express-serve-static-core"`, which
  fails to resolve under this project's `moduleResolution: "Bundler"` setup. This
  pattern is reused again in Step 4 for `req.auth`.
- `exactOptionalPropertyTypes: true` (already active project-wide) means an optional
  response field must be **omitted via conditional spread**
  (`...(err.details ? { details: err.details } : {})`), never assigned `undefined`
  explicitly — this caused real TS errors on first attempt, now the established pattern
  for any future optional-field response body.

### 3.3 Step 3 — Health / readiness

```text
apps/api/src/routes/
└── health.ts    # GET /health (liveness, no deps) and GET /health/ready
                   # (readiness, real `SELECT 1` via @trading/database's prisma client)
```

`healthRouter` is explicitly typed (`const healthRouter: ExpressRouter = Router()`) to
satisfy TS2742 ("inferred type cannot be named without a reference to ... this is
likely not portable") — an unavoidable consequence of `declaration: true` + `composite:
true` + pnpm's nested `.pnpm/` node_modules layout for `@types/express-serve-static-core`.
Any future exported Router in this codebase needs the same explicit annotation.

Readiness returns `503` with a generic `"database": "unavailable"` body on failure,
logs full diagnostic detail server-side only (`09-security-spec.md` §28, never leak
connection strings/driver errors to the client). Verified manually by stopping/starting
the Postgres container mid-session.

### 3.4 Step 4 — Authentication (JWT + bcryptjs)

**Major mid-step architectural finding, resolved this session (see §4 for full
rationale):** `packages/domain`'s `User` entity and `UserRepository` contract have
**zero password/credential fields** — confirmed by reading the actual files, not
assumed. The repository contract's own comment had already anticipated this:
password handling "belongs to a dedicated authentication capability, not this
repository." That capability didn't exist yet; this session built it.

**New domain layer (packages/domain):**
```text
packages/domain/src/
├── entities/
│   ├── credential.ts         # Credential { userId, passwordHash, createdAt, updatedAt }
│   │                            # Pure domain type — never sees a raw password, has
│   │                            # zero dependency on bcrypt/argon2/any hashing library.
│   │                            # validateNewCredential() only checks shape (userId +
│   │                            # non-empty hash present), NOT raw password strength —
│   │                            # that belongs at the API/Zod boundary, which doesn't
│   │                            # exist yet because there is no registration endpoint,
│   │                            # only login against seeded data.
│   └── credential.test.ts
└── repositories/
    └── credential-repository.ts   # getByUserId / create / updatePasswordHash
```

**New database layer (packages/database):**
```text
packages/database/
├── prisma/
│   └── schema.prisma            # + model Credential (userId @id, 1:1 with User,
│                                   # onDelete: Cascade) — new migration generated
│                                   # (`add_credential_table`, run by user via
│                                   # `pnpm --filter @trading/database db:migrate`)
└── src/
    ├── mappers/
    │   └── credential-mapper.ts
    ├── repositories/
    │   ├── prisma-credential-repository.ts
    │   └── prisma-credential-repository.test.ts
    └── seed/
        ├── data/
        │   └── credential.ts      # SEED_PASSWORD_HASH — pre-computed bcrypt hash
        │                            # ($2b$, 10 rounds) for plaintext "demo1234",
        │                            # documented in-file since this is synthetic
        │                            # demo data, not a real secret
        ├── steps/
        │   └── seed-users-and-portfolios.ts   # edited: now also creates the demo
        │                                        # user's Credential row
        └── wipe.ts                              # edited: deletes credentials before
                                                    # users (FK order)
```

**New `apps/api` auth capability:**
```text
apps/api/src/
├── config/
│   └── env.ts                  # Zod-validated env: PORT, JWT_SECRET (min 32 chars),
│                                  # JWT_EXPIRES_IN_SECONDS (number, default 900).
│                                  # Fails fast (process.exit(1)) on invalid config,
│                                  # per 14-deployment-spec.md §12. Loaded via
│                                  # dotenv-cli (`dotenv -e ../../.env -- ...`) in
│                                  # package.json scripts — same pattern already
│                                  # established by packages/database; tsx/node do
│                                  # NOT auto-load .env on their own.
├── schemas/
│   └── auth.schema.ts             # Zod: loginRequestSchema { email, password }
├── services/
│   └── auth.service.ts             # login(email, password) -> { user, token }
│                                     # getCurrentUser(userId) -> refetches from DB,
│                                     # does not trust JWT payload alone for anything
│                                     # beyond identity (role could have changed)
├── middleware/
│   └── authenticate.ts              # Verifies Bearer JWT, attaches req.auth =
│                                      # { userId, role }. Single generic 401 for
│                                      # every failure mode (missing header, bad
│                                      # signature, expired, malformed payload) —
│                                      # never reveals which one applied.
└── routes/
    └── auth.routes.ts                # POST /api/v1/auth/login
                                        # GET  /api/v1/auth/me  (protected)
```

**Verified end-to-end manually** (PowerShell `Invoke-RestMethod`, see §5 for the
`curl.exe`/PowerShell escaping issue that had to be worked around first):
- successful login returns a well-formed JWT (`sub`, `role`, `iat`, `exp`)
- wrong password -> `401 UNAUTHORIZED "Invalid credentials."`
- non-existent email -> **identical** `401` (anti-enumeration confirmed,
  `09-security-spec.md` §51)
- malformed body -> `400 VALIDATION_ERROR` with per-field details
- `/auth/me` without token -> `401`
- `/auth/me` with valid token -> `200` with fresh user data
- `/auth/me` with expired token -> `401` (confirmed by letting a token expire
  naturally during the session — `JWT_EXPIRES_IN_SECONDS=900` behaves correctly)

---

## 4. Key Decisions Made This Session

| Decision | Reason |
|---|---|
| **`Credential` is a separate entity/table from `User`**, not a `passwordHash` column bolted onto `User` | Honors a decision already implicitly made in Phase 1: `user-repository.ts`'s own comment explicitly says credential handling is out of scope for that contract and "belongs to a dedicated authentication capability." Also matches `09-security-spec.md` §58's principle of keeping authentication and authorization/identity concerns separate. |
| **`bcryptjs` over native `bcrypt`** | Native `bcrypt` requires compiled bindings (node-gyp/OpenSSL), a real risk of dev-machine-vs-hosting-provider binary mismatch (`14-deployment-spec.md` NFR-046/052/053 — frictionless setup, free-tier deployment portability). `bcryptjs` is a pure-JS reimplementation of the same algorithm/hash format, zero native compilation, portable everywhere. Performance difference is irrelevant at this project's scale. |
| **`bcryptjs` over `argon2`** | User's explicit choice, aligned with NFR-070 (avoid unnecessary complexity for a portfolio project) and personal/professional familiarity. `argon2` (OWASP's current top pick) was offered as the more modern alternative but rejected deliberately, not by oversight — documented here so it isn't silently "corrected" later without reason. |
| **Demo password hash pre-computed once (`$2b$`, 10 rounds) and hardcoded as a plain string in `packages/database`'s seed data**, rather than adding `bcryptjs` as a dependency of `packages/database` to hash at seed time | `packages/database` has no other runtime need for a hashing library — hashing/verification is `apps/api`'s concern only. Avoids an unnecessary dependency in a package that doesn't need it (NFR-070), and keeps the seed fully deterministic. |
| **`JWT_EXPIRES_IN_SECONDS` as a plain number (seconds), not a duration string like `"15m"`** | `@types/jsonwebtoken` v9 types `SignOptions.expiresIn` as `number \| ms.StringValue` (a strict template-literal type). A plain `z.string()` env var doesn't satisfy `ms.StringValue` without an awkward cast. Using seconds-as-number sidesteps this cleanly and is exactly as readable. |
| **`Express.Request` augmented via `declare global { namespace Express { ... } }`**, not `declare module "express-serve-static-core"` | The latter fails to resolve under this project's `moduleResolution: "Bundler"` setting (confirmed by a real TS2306 "cannot be found" error this session). The global-namespace pattern is the portable one and is now used consistently for both `req.requestId` and `req.auth`. |
| **`apps/api/tsconfig.json` needed an explicit `"references": [{ path: "../../packages/database" }]`** | TypeScript project-references rule: a composite project consuming types from another composite project must declare that reference explicitly, or cross-project types resolve as unresolved/`any` under `tsc --build` (which is what root `pnpm typecheck` runs) even though a plain `tsc --noEmit` on the single package might appear to work. This was the real root cause behind a confusing "Unsafe member access .$queryRaw on a type that cannot be resolved" error in Step 3 — not a Prisma or ESLint bug. |
| **Router-typed exports need an explicit type annotation** (`const healthRouter: ExpressRouter = Router()`) | TS2742: with `declaration: true` + `composite: true`, TS cannot always portably name an inferred type that comes from a package nested inside pnpm's `.pnpm/` structure (here, `@types/express-serve-static-core`). Explicit annotation sidesteps the portability check entirely. Applies to any future exported `Router`. |
| **`dotenv-cli` added to `apps/api`'s `dev`/`start` scripts**, matching `packages/database`'s existing pattern exactly | `tsx`/`node` do not auto-load `.env` files. This was already solved once in Phase 2 for `packages/database` — Phase 3 initially missed it (caused a real `JWT_SECRET` validation failure at startup) and was corrected to reuse the identical established pattern rather than inventing a new one (e.g. a `dotenv.config()` call inside `env.ts`, which would have been a second, inconsistent way of doing the same thing). |
| **`getCurrentUser` refetches the user from the database rather than trusting the JWT payload for anything beyond identity (`sub`)** | `09-security-spec.md` §11: authorization must be enforced server-side and the frontend/JWT-claims are not the source of truth. A role change or account deactivation after token issuance must be reflected without waiting for token expiry. |
| **RBAC (`requireRole()` middleware) deliberately deferred**, not built in this session despite being grouped with "Auth" in `15-implementation-plan.md` Phase 4 | No route exists yet that actually needs role restriction — building it now would be speculative infrastructure with no consumer (NFR-070: "avoid artificial complexity... complexity must correspond to an actual requirement"). Explicit user decision this session (Option B over Option A) to proceed straight to the first real business endpoint (Portfolios) instead, and add `requireRole()` when a genuine admin-only operation appears. |

---

## 5. Corrections / Bugs Caught This Session

Same discipline as Phases 1-2 — every fix below was found by reading real files via the
filesystem MCP or by hitting real terminal/compiler/lint output, never assumed:

1. **`declare module "express-serve-static-core"` failed to resolve** ("Invalid module
   name in augmentation, module cannot be found") on the very first version of
   `request-id.ts`. Root cause: incompatible with this project's `moduleResolution:
   "Bundler"`. Fixed by switching to `declare global { namespace Express { ... } }`,
   which is resolution-mode-agnostic. Same fix reused proactively in `authenticate.ts`.
2. **`exactOptionalPropertyTypes: true` rejected `details: err.details`** in
   `error-handler.ts` when `err.details` could be `undefined`, because the target
   interface's `details?:` field cannot be explicitly assigned `undefined` under this
   flag — it must be omitted entirely. Fixed with a conditional spread
   (`...(err.details ? { details: err.details } : {})`).
3. **TS2742 on `healthRouter`** ("inferred type cannot be named without a reference...
   this is likely not portable") — required an explicit `ExpressRouter` type
   annotation. Root cause: `declaration: true` + `composite: true` + pnpm's nested
   `@types/express-serve-static-core` location.
4. **"Unsafe member access .$queryRaw on a type that cannot be resolved" (ESLint,
   `@typescript-eslint/no-unsafe-member-access`)** — initially misdiagnosed as a
   possibly-stale generated Prisma Client. Verified via filesystem MCP that
   `generated/client/index.d.ts` **did** correctly export `Credential`/etc. Real root
   cause: `apps/api/tsconfig.json` had no `"references"` to `packages/database` at
   all — required for `tsc --build` (root `pnpm typecheck`) to resolve cross-composite-
   project types reliably. Fixed by adding the reference. This is a durable, reusable
   lesson (see §4).
5. **Editor showed persistent stale ESLint/TS errors even after `pnpm lint`/`pnpm
   typecheck` ran clean in the terminal**, on at least two separate occasions this
   session (once for the `$queryRaw` issue, once after the `credential-mapper.ts` fix).
   Confirmed each time: terminal output is authoritative; editor's ESLint/TS server
   caches are not reliably invalidated by file edits made outside the editor itself
   (several edits this session were applied directly via the filesystem MCP, not typed
   into the editor). Restarting the ESLint/TS server (or reopening the editor) clears
   it. **This is now a standing pattern for this project, not a one-off** — don't
   trust editor-displayed errors over a clean terminal run.
6. **`packages/database/src/mappers/credential-mapper.ts` was saved to disk with
   completely different, broken content than what was provided** — imported
   `PrismaCredentialRepository` (the repository class) instead of `Credential` (the
   generated Prisma row type), and was missing the required `.js` extension on the
   relative import. This produced 4 "Unsafe assignment of an error typed value" ESLint
   errors, because the broken import resolved to an implicit `any`. Root cause was
   never conclusively identified (possibly an editor autocomplete substitution or a
   copy-paste mismatch) — caught by re-reading the actual file content via the
   filesystem MCP rather than assuming the artifact content had been applied correctly.
7. **`curl.exe` on PowerShell mangled escaped JSON quotes** (`\"email\":...`),
   producing `SyntaxError: Expected property name or '}' in JSON at position 1` on the
   server. Not a code bug — a shell-escaping mismatch between PowerShell's string
   parsing and `curl.exe`'s expectations. Resolved by switching to PowerShell-native
   `Invoke-RestMethod` with `ConvertTo-Json`, which is now the established way to
   exercise this API manually in this environment going forward — stop reaching for
   `curl.exe` with double-quote escaping on this machine.
8. **`apps/api`'s `dev`/`start` scripts did not load `.env`** (`JWT_SECRET: invalid
   input: expected string, received undefined` at startup, even though `.env` had the
   correct value). Root cause: `tsx`/`node` don't auto-load `.env`; `packages/database`
   had already solved this via `dotenv-cli` (`dotenv -e ../../.env -- ...`) but
   `apps/api`'s initial scaffold in Step 1 didn't replicate that pattern. Fixed by
   adding `dotenv-cli` as a devDependency and updating the two affected scripts to
   match `packages/database`'s exact convention.
9. **Minor, non-blocking, still-open:** the `401` error responses from
   `/api/v1/auth/login` show `"details":[]` in the JSON body instead of omitting the
   `details` key entirely (which is what happens when `AppError` is constructed
   without a 4th argument, per the conditional-spread fix in item 2 above). Flagged by
   the user, deliberately **not** investigated this session (agreed to defer) — see
   §8 Open Items.

**Lesson reinforced (fourth session running):** reading the actual file content via the
filesystem MCP immediately before and after any edit — not just before, per item 6
above — is now non-negotiable for this project. An edit can silently fail to apply as
intended even when the tool reports success, especially when content passes through
manual copy-paste.

---

## 6. How to Resume From Here (Phase 3 continuation — Option B — kickoff)

1. Read this file in full.
2. Use the filesystem MCP to independently verify current repo state:
   - Confirm `apps/api/src/` matches the tree in §3.1-3.4 above (config/, schemas/,
     services/, middleware/, routes/, errors/ all present with the files listed).
   - Confirm `apps/api/package.json` has `dotenv-cli`, `express`, `bcryptjs`,
     `jsonwebtoken`, `zod`, and their `@types/*` where applicable, actually present in
     `dependencies`/`devDependencies` (this session installed them via `pnpm add`
     commands run by the user, not written directly by the assistant — verify they
     landed correctly).
   - Confirm `apps/api/tsconfig.json` still has the `references` array pointing to
     `packages/database`.
   - Confirm `.env` (not `.env.example`) has `PORT`, `JWT_SECRET`,
     `JWT_EXPIRES_IN_SECONDS` set (these are gitignored, so a fresh clone / new
     machine would need them recreated — `.env.example` documents the required keys
     but not real values).
3. Confirm local repo state: `git status`, `git branch --show-current`,
   `git log --oneline -30`.
4. Confirm Docker Postgres is running: `docker compose ps`.
5. Sanity-check the full stack still works end-to-end before building anything new:
   ```bash
   pnpm --filter @trading/api dev
   ```
   then a login + `/auth/me` round trip via PowerShell `Invoke-RestMethod` (not
   `curl.exe` — see §5 item 7).
6. **Before writing the Portfolios route**, read directly via the filesystem MCP (do
   not assume):
   - `packages/domain/src/repositories/portfolio-repository.ts` (contract — what
     methods exist, exact input/output shapes)
   - `packages/domain/src/entities/portfolio.ts` (entity shape, `validateNewPortfolio`
     signature)
   - `packages/database/src/repositories/prisma-portfolio-repository.ts` (confirm it
     already exists from Phase 2 — it should, per the original PROGRESS.md Phase 2
     seed work referencing `PrismaPortfolioRepository`)
7. Re-read `07-api-spec.md` §10-11 (Portfolio API, Portfolio Overview) and
   `09-security-spec.md` §14-15 (Resource Ownership, IDOR Protection) together before
   proposing the first route — ownership enforcement (a user can only see/modify their
   own portfolios) is the actual new architectural concern this step introduces, not
   just "another CRUD endpoint."
8. Propose Phase 3's Portfolios work as small, approvable sub-steps (same pattern as
   every step so far): likely `GET /api/v1/portfolios` (list, scoped to
   `req.auth.userId`) first, then `POST /api/v1/portfolios` (create), deferring
   update/archive/delete to later sub-steps.

---

## 7. Last Relevant Commits (this session, chronological)

```
feat(api): bootstrap apps/api with minimal express server
feat(api): add request id and centralized error handling middleware
feat(api): add health and readiness endpoints backed by postgres
feat(domain): add Credential entity and repository contract
feat(database): add Credential model, repository, and seed data
feat(api): implement login with jwt and bcryptjs against real postgres data
feat(api): add jwt verification middleware and protected /auth/me endpoint
```

Exact order/squashing at merge time is a decision for the next PR review, not fixed
here.

---

## 8. Open Items / Pending Decisions

- **8.1 through 8.9 (carried over from Phase 2, all still non-blocking, unchanged this
  session)** — see previous PROGRESS.md revision if needed; none were touched this
  session (Prisma major version deferral, branch-source enforcement on `main`, GitHub
  default branch, `packages/database`'s `typescript` devDependency version lag,
  Watchlist/UserPreference/MarketPrice/MarketEvent seed tables still intentionally
  unseeded).
- **8.10 (new, non-blocking) — `"details":[]` appears in error JSON bodies instead of
  the key being fully omitted**, for `AppError`s constructed without an explicit
  `details` argument (e.g. every `401` from the auth endpoints). Cosmetic only — does
  not affect client behavior, since consumers should check `details` truthiness/length
  either way. Deliberately deferred this session per user's explicit choice ("lo
  dejaría anotado y seguimos"). Worth a 5-minute isolated fix in a future session
  (likely: the JSON response body for `AppError` may need `details` typed and handled
  slightly differently than currently written in `error-handler.ts` — re-inspect that
  file's actual on-disk content before touching it, per the §5 item 6 lesson).
- **8.11 (new, non-blocking) — RBAC (`requireRole()` middleware) does not exist yet** —
  deliberate deferral (Option B, see §4). Must be built the first time a genuine
  admin-only operation is introduced. Do not build it speculatively before that.
- **8.12 (new, non-blocking) — No registration/`POST /api/v1/auth/register` endpoint
  exists**, and none is currently planned — the only way a `Credential` row gets
  created today is via the database seed. This matches `12-demo-mode-spec.md` §55
  (demo auth creates a controlled identity automatically, no real registration flow
  required) and is intentional, not an oversight — flagged here only so a future
  session doesn't assume registration exists.
- **8.13 (new, non-blocking) — Refresh tokens are not implemented.** `09-security-spec.md`
  §7 mentions short-lived access tokens "and an appropriate refresh strategy where
  required." Current implementation only has a single 900-second access token with no
  refresh mechanism — acceptable for the current demo-scale scope, but worth
  revisiting if session-expiry UX becomes a real product concern later (likely a
  Phase 5+/frontend-driven concern, not urgent now).