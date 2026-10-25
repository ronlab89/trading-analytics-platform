# ADR-006: Deployment Model and Minimal Continuous Integration

**Status:** Accepted
**Date:** 2026-10-04
**Supersedes:** the "no CI" decision recorded in `PROGRESS.md` §7
**Amended:** 2026-10-07 (point 12, graceful shutdown, approved by the user
from the `13-observability-spec.md` reconciliation; points 4, 5, 7, 8, 11
and 12 and new point 13, approved by the user from the
`14-deployment-spec.md` reconciliation; points 5 and 11, smoke test data,
approved by the user on 2026-10-08 from the `15-implementation-plan.md`
reconciliation)
**Implemented in:** CI and configuration safety before or in roadmap block
B0; build and containers in B7 (B7.1 to B7.4, closed 2026-10-25); graceful shutdown and startup entries in B3;
frontend build configuration and demo hosting in the frontend phase

## Context

`14-deployment-spec.md` assumes a hosted backend, a managed PostgreSQL
database, a reverse proxy with HTTPS and WSS, and a CI/CD pipeline. The
project's actual model differs:

- The backend runs locally only, for interview demonstrations.
- The public demo is the frontend running on mocked infrastructure
  (ADR-001, ADR-002), hosted under a subpath of the author's portfolio site.

Other facts:

- The production build does not run. `@trading/domain` and
  `@trading/database` set `main` to `./src/index.ts`, and the domain uses
  extensionless relative imports, which `node dist/index.js` cannot resolve.
- No document covers hosting under a subpath (base path, SPA fallback,
  storage namespacing).
- Environment variable names disagree between documents and code: backend
  port 3000 in `14-deployment-spec.md` §9 versus 7001 in `env.ts`;
  `JWT_EXPIRES_IN` versus `JWT_EXPIRES_IN_SECONDS`; `APP_MODE` versus
  `DEMO_MODE`.
- CI was previously rejected because, without continuous deployment, it was
  seen as adding nothing over running tests locally. Three gaps remain
  without it: nothing proves the repository works from a clean checkout
  (`15-implementation-plan.md` rule 10), pull requests merge with no
  automated gate, and the project shows no evidence of being maintained.

## Decision

1. **Targets.** Exactly two:
   - **Local full stack**, production-like, used for demonstrations.
   - **Public demo**, a static build of `apps/web` in demo mode.
2. **No public backend.** The hosting, managed database, reverse proxy and
   public WSS sections of `14-deployment-spec.md` become `Deferred`. Hosting
   the backend later requires a new ADR.
3. **Production build.** Every workspace package compiles to `dist` and
   exposes it through `exports`. The API runs with `node dist/index.js`.
   Implementation details were settled in B7.1 (see the implementation
   record below).
4. **Containers.** A multi-stage API Dockerfile running as a non-root user.
   Docker Compose gains a `full` profile (PostgreSQL and API) for the
   production-like local run. The default profile keeps only PostgreSQL for
   development. (Amended 2026-10-07, approved by the user from the
   `14-deployment-spec.md` reconciliation; `Implemented` in B7.2 and B7.3:)
   - **Migration service.** `prisma migrate deploy` runs as a one-shot
     `migrate` service in the `full` profile. The API service has
     `depends_on: migrate` with `condition: service_completed_successfully`
     (`14-deployment-spec.md` §15, §26).
   - **Entrypoint.** The API container starts with `node dist/index.js`
     directly, with no shell or package-manager wrapper, so `SIGTERM`
     reaches the process (point 12).
   - **Dockerfile.** `apps/api/Dockerfile`, built with the workspace root as
     the build context (§26).
   - **Healthcheck.** The container healthcheck probes
     `GET /health/ready` (§51).
   - **Time zone.** The API and PostgreSQL containers run with `TZ=UTC`
     (§60).
5. **Migrations and seed.** Startup applies `prisma migrate deploy`. The
   seed never runs automatically; it is an explicit development command.
   (Amended 2026-10-07: in the `full` profile, "startup applies" means the
   `migrate` service of point 4. The seed refuses to run in production, see
   point 13.) (Clarified 2026-10-08, approved by the user: the data for the
   smoke test of point 11 comes from an explicit `db:seed` step; see
   "Smoke test data" under point 11. This point and point 13 stay valid.)
6. **Rollback.** Forward-fix only. Prisma Migrate has no down migrations, so
   "controlled rollback" is removed from the specification.
7. **Demo under a subpath.** Configurable base path, SPA fallback,
   namespaced browser storage, no calls to any backend, and no secrets in
   the build. (Amended 2026-10-07: demo hosting, the base path value, the
   SPA fallback mechanism and the numeric bound of the demo simulation are
   decided in the frontend-stage ADR, ADR-010 point 6; the requirements
   above stay.)
8. **Environments and variables.** `development`, `test` and local
   `production`. Canonical names: `PORT` (default `7001`),
   `JWT_EXPIRES_IN_SECONDS`, and `APP_MODE` with values `real` or `demo`
   (exposed to the web build as `VITE_APP_MODE`). (Amended 2026-10-07,
   approved by the user from the `14-deployment-spec.md` reconciliation;
   `Planned (FE)`:)
   - **Build-time values.** `VITE_APP_MODE` and the API and WebSocket base
     URLs (proposed names `VITE_API_BASE_URL` and `VITE_WS_URL`) are
     build-time values. The demo bundle therefore contains no HTTP adapter.
   - **Real-mode web app.** It runs on the Vite dev server against the local
     API (`14-deployment-spec.md` §14, §23, §27).
9. **Backups.** Not applicable to a local environment. Documented as such,
   not claimed.
10. **Minimal CI.** One GitHub Actions workflow on pushes and pull requests
    to `develop` and `main`: install with the lockfile, typecheck, lint, and
    the domain, database and API test suites, the latter two against a
    PostgreSQL service container. No continuous deployment.
11. **CI scope, coverage and frontend test tooling** (added 2026-10-06,
    approved by the user, from the `10-testing-strategy.md`
    reconciliation; `Planned (B0)` with point 10):
    - **Formatting and build.** The point 10 workflow also runs
      `pnpm format:check` and `pnpm build`. Building in CI proves the
      packages compile from a clean checkout; running the built API stays
      a B7 concern (point 3).
    - **No coverage threshold.** Version 1 sets no coverage percentage and
      configures no coverage gate in CI. The quality bar is the named
      mandatory tests: application services with in-memory fakes
      (ADR-001 point 7) and contract tests against the `@trading/contracts`
      schemas (ADR-002 point 6). A threshold stays `Deferred`.
    - **Frontend test tooling.** The component test runner, React Testing
      Library and Playwright are decided in the frontend-stage ADR, like the
      demo specifics (ADR-010 point 6). They stay `Deferred` until then and
      do not block B0-B7. Component, E2E and accessibility checks join the
      point 10 workflow once frontend code exists, as that ADR decides. The
      accessibility scanning tool is also chosen there. The HTTP client's
      timeout and retry policy is decided there too, consistent with
      ADR-002 point 10 (the API has no server timeout).
    - **Additions** (added 2026-10-07, approved by the user from the
      `14-deployment-spec.md` reconciliation; `Planned (B0)`):
      - **Documentation check.** The workflow also runs `pnpm docs:check`.
        `docs/` is in `.prettierignore`, so `format:check` does not cover it.
        This closes the CI part of task T1.5.
      - **Test variables.** CI supplies them through the job `env`. It does
        not generate `.env.test.local` (`14-deployment-spec.md` §43).
      - **Database roles.** The CI test database uses the runtime and
        migration roles of ADR-005 point 13 (§42).
      - **Smoke test.** One smoke-test script runs after
        `docker compose --profile full up`, with no frontend step (§49).
        `Implemented` in B7.4 (`pnpm smoke`), with the `full` profile.
      - **Smoke test data** (added 2026-10-08, approved by the user, from the
        `15-implementation-plan.md` reconciliation, §37; `Implemented` in B7.4, see
        the amendment in the implementation record below). The
        `full` stack is local-only, so it runs with `NODE_ENV` set to a value
        other than `production` (`development`; "production-like" describes
        the build and containers, not the environment variable). The smoke
        test therefore runs `db:seed` as an explicit step of its script,
        after `docker compose --profile full up` and before it logs in. The
        seed never runs automatically on startup (point 5) and the production
        guard of point 13 is unchanged and untouched by the smoke test.
12. **Graceful shutdown** (added 2026-10-07, approved by the user, from the
    `13-observability-spec.md` reconciliation; `Implemented` in B3.4, with the
    lifecycle entries of ADR-009 point 11). `14-deployment-spec.md` §16
    requires it. On `SIGTERM` or
    `SIGINT`:
    - The server stops accepting connections.
    - `GET /health/ready` returns 503 while the API is shutting down.
    - In-flight requests drain, with a timeout of 10 seconds.
    - Prisma is closed.
    - The API logs `app.shutdown.started` and `app.shutdown.completed`
      (ADR-009 point 11).
    - **Exit code** (added 2026-10-07, approved by the user from the
      `14-deployment-spec.md` reconciliation, §16). If the 10-second drain
      expires, the remaining connections are closed and the process exits
      with code 1; otherwise it exits with 0.
    - **Readiness body** (added 2026-10-07, same approval, §50). While the
      API is shutting down, the 503 body of `GET /health/ready` is
      `status: "unavailable"` with no `checks`.
13. **Configuration safety and runtime version** (added 2026-10-07, approved
    by the user from the `14-deployment-spec.md` reconciliation;
    `Planned (B0)`):
    - **Production guard.** The seed and the hard database reset refuse to
      run when `NODE_ENV=production`. Today the seed wipes the database with
      no guard (`14-deployment-spec.md` §20-21).
    - **`CORS_ORIGIN` validation.** Only `http(s)://host[:port]` origins are
      accepted, and `*` is rejected (§33).
    - **Node version.** A single `.nvmrc` is the source of truth, reused by
      CI and the Dockerfile, with `engines.node` and `@types/node` aligned
      to it. The exact major is chosen in B0, when CI is created, after
      confirming it is an LTS release (§37, §43, §59).

## Consequences

**Positive**

- The specification describes infrastructure that will actually exist.
- Clean-checkout reproducibility is verified on every push.
- Pull requests get an automated gate.
- The public demo has no backend, no secrets and no running cost.

**Negative**

- CI must create and migrate a test database, and test environment values
  must be provided to the workflow.
- A broken build on `develop` becomes visible and must be fixed promptly.
- The full-stack experience is only available on the author's machine.

**Documents to align**

- `14-deployment-spec.md`: current model first, hosted sections deferred,
  variable names, rollback, graceful shutdown (§16, point 12), and the
  2026-10-07 decisions (points 4, 5, 7, 8, 11, 12 and 13).
- `13-observability-spec.md` and `10-testing-strategy.md`: CI references.
- `CONTRIBUTING.md`: CI gate wording, local gate commands.
- `12-demo-mode-spec.md` and `04-tech-stack.md`: `APP_MODE`.
- `PROGRESS.md` §7: CI decision superseded.

## Alternatives Considered

- **No CI (previous decision).** Leaves clean-checkout reproducibility and
  pull-request gating unverified. Superseded.
- **Full CI/CD with a hosted backend.** Running cost and operational scope
  beyond a portfolio project that is demonstrated locally. Rejected.
- **Bundling the API with a single-file bundler instead of building
  packages.** Hides the package-resolution problem rather than fixing it,
  and the web app needs consumable packages anyway. Rejected.

## Deferred detail

Implementation edge cases that do not change this decision. Each is
specified and tested in the listed block.

| Item | Resolution | Block |
|---|---|---|
| In the `full` Compose profile the `migrate` service may run before PostgreSQL accepts connections. | The `migrate` service has `depends_on` PostgreSQL with `condition: service_healthy`; the API then waits for `migrate` with `service_completed_successfully` (point 4). Done in B7.3. | B7 |
| `connection_limit` of the Prisma connection pool in the `full` profile. | Stays at Prisma's default until measured. Nothing was measured and no value is set (B7.3). | B7 |
| Rate limits in development. | Stay on. Restarting the API clears the counters. | B0 |
| How the `full` stack obtains data for the smoke test while the seed never runs automatically (point 5) and refuses `NODE_ENV=production` (point 13). | Point 11, "Smoke test data" (added 2026-10-08): the stack runs with `NODE_ENV` other than `production`, and the smoke script runs `db:seed` explicitly. Tests: the smoke script seeds before it logs in, and running the seed with `NODE_ENV=production` is still refused (point 13). In B7.4 the seed is a separate command run before `pnpm smoke`, from the host; see the amendment in the implementation record. | B7 |
| Point 12 covers the HTTP server and the database. The shutdown steps of `14-deployment-spec.md` §16 for background jobs and realtime connections are not decided there. | Added to the shutdown sequence when the job runner (ADR-008) and the realtime server (ADR-007) exist. | B4, B5 |

## Implementation record (B7)

Recorded when B7 closed (2026-10-25). It states what was built for points 3,
4, 5 and 11 and the decisions taken on the way; the points above stay as
decided, except where a line below says otherwise.

- **Build path (point 3, B7.1).** Relative imports end in `.js` and the
  packages use `NodeNext`, so `tsc` rejects a missing extension and no bundler
  is needed. Each package exposes `dist` through `exports`; the custom
  condition `@trading/source` points tests, `tsx` and `tsc` at the sources.
  `@trading/database` builds with `tsconfig.build.json` (`rootDir: src`).
  `DATABASE_URL` is validated at startup. CI builds the packages and starts
  the built API against the service container, checking `GET /health/ready`.
- **Image (point 4, B7.2).** `apps/api/Dockerfile` has the stages `build`,
  `deps`, `migrate` and `runtime`, built from the workspace root. The runtime
  stage is `node:24-slim` (the `NODE_VERSION` argument, the value of `.nvmrc`)
  plus `openssl`, runs as `node` with `TZ=UTC`, carries no compiled tests and
  no `.env`, and starts with `node dist/index.js`. The healthcheck is a
  `node -e` `fetch` of `GET /health/ready`, so no `curl` is needed. The
  production tree comes from `pnpm install --prod --frozen-lockfile
  --ignore-scripts`: `pnpm deploy` was rejected because `@trading/database`
  lists only `dist` in `files` and would drop the generated client.
- **Profile (points 4 and 5, B7.3).** The `full` profile adds the one-shot
  `migrate` service (the `migrate` image target, which runs
  `prisma migrate deploy` and then sets the runtime role password) and the
  `api` service. The chain is PostgreSQL healthy, then `migrate` completed,
  then `api`. The API connects as `trading_runtime` through the network name
  `postgres`. Both published ports bind to `127.0.0.1`. `JWT_SECRET` has no
  default; the database passwords keep local defaults. `connection_limit` is
  left at Prisma's default.
- **Smoke test (point 11, B7.4).** `scripts/smoke.mjs`, run as `pnpm smoke`,
  checks readiness, an unauthenticated request (401), the login of the seeded
  user and a read of the seeded portfolios. It does not start the stack or run
  the seed: the flow is `docker compose --profile full up`, the seed, then
  `pnpm smoke`. CI does not run it.
- **Amendment to "Smoke test data" (point 11).** The `api` service of the
  `full` profile runs with `NODE_ENV=production`, and the seed runs from the
  host with the development values of `.env`. The production guard of point 13
  is therefore untouched, as the decision required, but the stack does not run
  with `NODE_ENV` set to `development`. This was recorded in B7.7 from what
  B7.3 and B7.4 built; it is not a new decision.
- **Hardening (B7.5, B7.6).** The assets search escapes `%`, `_` and `\`. The
  final security pass is `odd/tasks/b7/b7-6-security-pass.md`: three advisories
  fixed, `mem_limit: 512m` on the `api` service (NFR-054) and a test that pins
  the security headers. `deepmerge-ts` (GHSA-ggr8-5vv4-36mx) stays `Deferred`:
  it is reached only through the Prisma CLI config and its fix needs Prisma 7.

## Related

- ADR-001, ADR-002 (demo runs the application in process; mandatory
  tests of point 11)
- ADR-005 point 13 (runtime and migration roles)
- ADR-008 point 5 (jobs interrupted at shutdown resume on startup)
- ADR-009 point 11 (startup and shutdown lifecycle entries)
- ADR-010 point 6 (frontend-stage ADR)
- `10-testing-strategy.md` §5, §53-§55
- `14-deployment-spec.md`, `15-implementation-plan.md` rule 10
- `PROGRESS.md` §7
