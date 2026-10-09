# B0.3 Characterization route tests

Source: roadmap B0 lines 186-189; ADR-001 point 8; plan lines 410 and 632-644. Depends on: B0.1. Tests only, no production code changes.

## Allowed edit surfaces

apps/api/src/routes/**/\*.test.ts
apps/api/src/test/**

## Tasks

- [ ] T1 Route tests for analytics.
- [ ] T2 Route tests for positions.
- [ ] T3 Route tests for assets.
- [ ] T4 Route tests for market.
- [ ] T5 Route tests for `GET /health` and `GET /health/ready`.

Tests pin today's HTTP behavior (status, body shape) so the later layering refactor is provably unchanged. Do not fix bugs found here; record them in this file.

## Done when

All new tests pass against the current code.

## Verification

pnpm --filter @trading/api test.
