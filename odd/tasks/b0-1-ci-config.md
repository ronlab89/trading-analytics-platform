# B0.1 Minimal CI and configuration baseline

Source: `docs/BACKEND-ROADMAP.md` B0 "Minimal CI and configuration safety" (lines 115-134); `docs/15-implementation-plan.md` §5 (lines 187-214). Branch: `chore/b0-ci-config`. Depends on: nothing.

## Allowed edit surfaces

.github/workflows/ci.yml
.nvmrc
package.json
apps/api/package.json
packages/*/package.json
pnpm-lock.yaml
scripts/check-docs.mjs
scripts/check-docs.test.mjs
scripts/fixtures/**
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md
docs/15-implementation-plan.md

## Tasks

- [x] T1 `.nvmrc` with a confirmed LTS major; align `engines.node`, `@types/node` and `typescript` across packages.
- [x] T2 `ci.yml` on push/PR to `develop` and `main`: frozen-lockfile install, typecheck, lint, format:check, docs:check, test (PostgreSQL service container, test vars in job `env`), build. No deploy, no coverage threshold. The ADR-005 point 13 runtime and migration roles for the CI database move to B0.2.
- [x] T3 Harden `scripts/check-docs.mjs` (T1.5): one shared fence-state helper plus fixture-based tests.
- [x] T4 Update the status lines in the roadmap, PROGRESS and plan (`Planned (B0)` to `Implemented` for these items only). Applied across the SDD set after the first green CI run; the CI database roles (ADR-005 point 13) stay `Planned (B0)` for B0.2.

## Done when

CI is green on a clean checkout; `pnpm docs:check` and its fixture tests pass.

## Verification

pnpm typecheck; pnpm lint; pnpm format:check; pnpm docs:check; the fixture test runner the repo uses for `scripts/`.
