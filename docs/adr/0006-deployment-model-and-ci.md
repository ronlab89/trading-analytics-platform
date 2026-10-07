# ADR-006: Deployment Model and Minimal Continuous Integration

**Status:** Accepted
**Date:** 2026-10-04
**Supersedes:** the "no CI" decision recorded in `PROGRESS.md` §7
**Implemented in:** CI before roadmap block B0; build and containers in B7;
demo hosting in the frontend phase

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
   Implementation details are settled in B7.
4. **Containers.** A multi-stage API Dockerfile running as a non-root user.
   Docker Compose gains a `full` profile (PostgreSQL and API) for the
   production-like local run. The default profile keeps only PostgreSQL for
   development.
5. **Migrations and seed.** Startup applies `prisma migrate deploy`. The
   seed never runs automatically; it is an explicit development command.
6. **Rollback.** Forward-fix only. Prisma Migrate has no down migrations, so
   "controlled rollback" is removed from the specification.
7. **Demo under a subpath.** Configurable base path, SPA fallback,
   namespaced browser storage, no calls to any backend, and no secrets in
   the build.
8. **Environments and variables.** `development`, `test` and local
   `production`. Canonical names: `PORT` (default `7001`),
   `JWT_EXPIRES_IN_SECONDS`, and `APP_MODE` with values `real` or `demo`
   (exposed to the web build as `VITE_APP_MODE`).
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
      do not block B0-B7.

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
  variable names, rollback.
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
| In the `full` Compose profile the API may run `migrate deploy` before PostgreSQL accepts connections. | `depends_on` with `condition: service_healthy`. | B7 |

## Related

- ADR-001, ADR-002 (demo runs the application in process; mandatory
  tests of point 11)
- ADR-010 point 6 (frontend-stage ADR)
- `10-testing-strategy.md` §5, §53-§55
- `14-deployment-spec.md`, `15-implementation-plan.md` rule 10
- `PROGRESS.md` §7
