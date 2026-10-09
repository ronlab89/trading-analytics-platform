# B0.6 In-memory repositories, UnitOfWork and shared contract suite

Source: roadmap B0 lines 150-151 and 190-194; deferred detail (in-memory UnitOfWork). Depends on: B0.5.

## Allowed edit surfaces

packages/application/src/testing/**
packages/database/src/**/\*.test.ts
packages/database/src/contract/**

## Tasks

- [ ] T1 In-memory implementations of the repository contracts.
- [ ] T2 In-memory `UnitOfWork` with rollback and an async mutex (interleaved units cannot erase each other's writes).
- [ ] T3 Extract one repository contract suite from the existing Prisma tests; run it against Prisma and in-memory.

## Done when

The contract suite passes against both implementations.

## Verification

pnpm --filter @trading/application test; pnpm --filter @trading/database test.
