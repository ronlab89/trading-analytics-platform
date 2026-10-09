# B0.5 Application layer, Clock and composition root

Source: roadmap B0 lines 136-153 and 182-185; ADR-001; ADR-005 point 3. Depends on: B0.3, B0.4. Highest risk: one resource per commit; run the adversarial review here.

## Allowed edit surfaces

packages/application/**
apps/api/src/composition.ts
apps/api/src/services/**
apps/api/src/controllers/**
apps/api/src/routes/**
apps/api/src/middleware/**
eslint.config.*
tsconfig*.json
apps/api/package.json
docs/06-architecture.md

## Tasks

- [ ] T1 Package scaffold (depends only on `@trading/domain`), application errors, `Actor`, permission mechanism, `Clock` port.
- [ ] T2 Composition root and ESLint import-boundary rule (replace the commented placeholder).
- [ ] T3 Move portfolios (factory, tests with fakes).
- [ ] T4 Move assets and market.
- [ ] T5 Move positions and transactions.
- [ ] T6 Move composite reads: overview, scenarios, decision replay, analytics.
- [ ] T7 Remove `new Date()` from domain and application code; fixed clock in tests. Reword the two stale async-creation comments.

## Done when

B0.3 and B0.4 tests pass unchanged; the lint rule fails on a Prisma or Express import inside `@trading/application`.

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/api test; pnpm lint; pnpm typecheck.
