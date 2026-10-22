# B5.6 Simulator in the server and control endpoints

Source: roadmap B5; ADR-007 points 7, 8, 10, 14, 15 and 16; `08-realtime-spec.md` §16, §40, §58; `07-api-spec.md` (simulation); ADR-009 point 11. Depends on: B5.3 and B5.5. Branch: `feat/b5-6-simulator-server`.

Working rules: tiny tasks, each approved by the user before any edit (or delegated for the whole slice); no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/application/src/**
packages/domain/src/**
packages/database/**
packages/contracts/src/**
apps/api/src/simulation/**
apps/api/src/routes/**
apps/api/src/controllers/**
apps/api/src/lifecycle/**
apps/api/src/logging/**
apps/api/src/index.ts
apps/api/src/composition.ts
docs/07-api-spec.md
odd/tasks/b5/**

## Specs

- S1 A market-data adapter in `apps/api` drives the engine every second while `RUNNING`: each tick updates `MarketPrice` and appends a `MarketEvent` with the next `sequence` for the asset, and publishes `MARKET_PRICE_UPDATED`.
- S2 After a restart the engine starts from the persisted `MarketPrice` and `MAX(sequence)` per asset; `(assetId, sequence)` is unique.
- S3 At every UTC day rollover a daily `HistoricalPrice` candle is closed and `previousPrice` rolls to that close; on startup the candles for the days the server was offline are generated.
- S4 `POST /api/v1/simulation/start`, `POST /api/v1/simulation/pause` and `PUT /api/v1/simulation/mode` (body `{ "mode": "<wire id>" }`) require `simulation:control` (`ADMIN`); the lifecycle is `RUNNING <-> HALTED`; errors follow ADR-002 point 10.
- S5 `MarketEvent` retention is bounded and the rule is recorded; the decision on `Position.currentPrice` (read `MarketPrice` at query time, or update it on every tick) is made here and recorded.
- S6 The simulator stops in the shutdown sequence and logs `simulation.started`, `simulation.paused` and `simulation.mode.changed`.

## Tasks

- [ ] T1 `MarketEvent` sequence repository method and the persisted-state initialization.
- [ ] T2 Tick loop adapter: persist, publish, lifecycle state, shutdown step.
- [ ] T3 Day rollover and offline candle backfill.
- [ ] T4 Control endpoints with the permission and the contracts.
- [ ] T5 Retention, the `Position.currentPrice` decision and the `simulation.*` log events.

## Done when

A running server moves prices, appends events with gapless sequences across a restart, closes the daily candle at rollover, and only an `ADMIN` can control it.

## Risk

Items 1 (writes and deletes stored data, retention), 2 (a permission-gated control) and 4 (tick loop, restart ordering). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test; the DB-backed suites are run by the user.

## Log
