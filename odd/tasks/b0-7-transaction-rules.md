# B0.7 Transaction rules, archived guard and decimal strings

Source: roadmap B0 lines 152-153, 169-180 and the deferred-detail table (lines 217-232); ADR-003 point 6; ADR-002 point 9; ADR-010 point 5. Depends on: B0.6. Run the adversarial review here.

## Allowed edit surfaces

packages/domain/src/**
packages/application/src/**
packages/database/src/**
packages/database/prisma/seed.ts
packages/contracts/src/**
apps/api/src/**/*.test.ts
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Tasks

- [ ] T1 Chronological validation (FR-018), tiebreak by `executedAt` then creation order, with the BUY/SELL same-timestamp test.
- [ ] T2 Position projection rebuilt by date-order replay (backdating gives correct `averageEntryPrice` and `openedAt`).
- [ ] T3 Concurrent SELL (6 and 6 on a holding of 10): exactly one succeeds; concurrent test.
- [ ] T4 Archived-portfolio guard: mutations return 409 `CONFLICT` and write nothing (includes alert delete).
- [ ] T5 Decimal strings: `decision-replay.ts` and `scenario-impact.ts` use `Decimal` (exact `-12.3` test); fixed notation, never `5e-8`; seed and fixtures rewritten to strings.

## Done when

All "Done when" items of B0 in the roadmap hold; mark B0 closed in PROGRESS.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/database test; pnpm --filter @trading/api test.
