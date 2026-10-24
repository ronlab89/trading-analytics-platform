# B7.1 Production build and DATABASE_URL validation

Source: roadmap B7; ADR-006 point 3; `PROGRESS.md` §3.1 and §7; `15-implementation-plan.md` §8. Depends on: B0 to B6. Branch: `feat/b7-1-production-build`.

Working rules: one task at a time, RED test first where a runnable test exists, the user runs lint, typecheck and tests and commits.

## Allowed edit surfaces

packages/_/package.json
packages/_/tsconfig.json
packages/_/src/\**
apps/api/package.json
apps/api/tsconfig.json
apps/api/src/config/\**
tsconfig.base.json
vitest.workspace._ and package vitest configs
eslint.config.js
.github/workflows/ci.yml
docs/**
odd/tasks/b7/**

## Findings that shape the plan

- F1 Every workspace package sets `main` and `types` to `./src/index.ts` (`persistence-memory` also has `exports` pointing at `src`). `apps/api` is the only one that already runs from `dist` (`"start": "node dist/index.js"`).
- F2 The packages import each other's files without an extension (`export * from "./entities/enums"` in `packages/domain/src/index.ts`) and `tsconfig.base.json` uses `moduleResolution: Bundler`. `tsc` emits those specifiers unchanged, so Node ESM cannot load the compiled `dist` of any package. This is the real production-build bug. `apps/api` and `packages/database/src/client.ts` already use `.js` extensions.
- F3 The Prisma client is generated into `packages/database/generated/client` (gitignored output). `dist/client.js` reaches it with `../generated/client/index.js`, which resolves correctly from `dist`. The image must run `prisma generate` (B7.2).
- F4 `DATABASE_URL` and `MIGRATION_DATABASE_URL` are read by Prisma (`schema.prisma`), not by `apps/api/src/config/env.ts`, so a missing or malformed value fails at the first query, not at startup.

## Specs

- S1 Every workspace package compiles to `dist` and exposes it through `exports` (ADR-006 point 3).
- S2 `node dist/index.js` runs the API from a clean build, with no `tsx`, no path alias and no `src` import at runtime.
- S3 Development, tests and `tsc --noEmit` keep working without a prior build (decision D2).
- S4 The API refuses to start when `DATABASE_URL` is missing or is not a PostgreSQL URL, with a message that names the variable and never prints its value (`15` §8; T1 confirms the exact rule).
- S5 CI already runs `pnpm build`; it also starts the built API far enough to prove S2 (decision D3).

## Decisions to approve

- D1 Recommended: add `.js` extensions to the relative imports of the packages and move them to `module`/`moduleResolution: NodeNext`, so `tsc` itself rejects a missing extension. It matches `apps/api` and the generated client, keeps ADR-006 point 3 as written (compile every package to `dist`), and adds no bundler. Cost: a large mechanical diff (`size:exception`). Alternative: bundle the API with esbuild or tsup; smaller diff, but it contradicts "every workspace package compiles to `dist`" and needs an ADR amendment.
- D2 Recommended: `exports` with a custom condition (for example `"@trading/source": "./src/index.ts"`) that vitest, `tsx` and `tsc` (`customConditions`) enable, and `default` pointing at `dist`. T1 is a spike that proves it before any file moves. Fallback: tests and typecheck run after `pnpm build`.
- D3 Recommended: CI starts the built API against the service container and checks `GET /health/live`; the full-stack run stays in B7.4.

## Tasks

- [ ] T1 Spike: prove D1 and D2 on `@trading/domain` and `apps/api` (build, `node dist/index.js`, vitest and tsc still green). Report before touching the other packages.
- [ ] T2 Extensions and `NodeNext` across the packages, one package per commit if the diff is large.
- [ ] T3 `exports` and `dist` for each package, `files` field, root `build` order.
- [ ] T4 `DATABASE_URL` validation in `env.ts` with RED tests (missing, wrong scheme, valid).
- [ ] T5 CI step for S5 and the docs touched (`README` build and run notes).

## Done when

`pnpm build && node apps/api/dist/index.js` starts the API from a clean checkout and fails fast on a bad `DATABASE_URL`, while `pnpm test` and `pnpm typecheck` still run without a build.

## Risk

Item 5 (delivery or environment: package entry points and the build). Item 3 if `exports` change what other workspaces import. Gets its own commits; assess against `develop`.

## Verification

pnpm build; node apps/api/dist/index.js against the local database; pnpm lint; pnpm typecheck; pnpm test; pnpm docs:check.

## Log

L1 Request: "PR merged y develop actualizada, que sigue?" then "Si arranca la lectura" then "si armalos" (the task files for B7).
L2 Read-only exploration on 2026-10-24 produced F1 to F4; D1 to D3 wait for approval.
