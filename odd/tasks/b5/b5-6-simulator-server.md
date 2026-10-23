# B5.6 Simulator in the server and control endpoints

Source: roadmap B5; ADR-007 points 7, 8, 10, 14, 15 and 16; `08-realtime-spec.md` §16, §40, §58; `07-api-spec.md` (simulation); ADR-009 point 11. Depends on: B5.3 and B5.5. Branch: `feat/b5-6-simulator-server`. Test runner: Vitest (`pnpm --filter <package> test`).

Working rules: the user approved the whole slice at once ("haz B5-6 completo igual como hiciste B5-5"), with the decisions below taken from the recommendations; one commit per task; no subagents; push and PR stay with the user.

## Allowed edit surfaces

packages/application/src/**
packages/domain/src/**
packages/database/**
packages/persistence-memory/src/**
packages/contracts/src/**
apps/api/src/simulation/**
apps/api/src/routes/**
apps/api/src/controllers/**
apps/api/src/lifecycle/**
apps/api/src/logging/**
apps/api/src/index.ts
apps/api/src/composition.ts
apps/api/src/app.ts
apps/api/package.json
apps/api/tsconfig.json
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

The roadmap tasks were split against the code when the slice started (L2).

- [x] T1 `MarketEvent`: unique `(assetId, sequence)` migration and a bounded-retention method (S2, S5). Risk item 1. Commit `5b34a9b`.
- [x] T2 `HistoricalPriceRepository.getLatestByAssetId` and `PositionRepository.updateCurrentPriceByAssetId` (S2, S3, S5). Risk item 1. Commit `b1fcfdc`.
- [x] T3 The `simulation:control` use cases and the contracts: `SimulationControl` port, `createSimulationService`, mode request and status response (S4). Commit `71b239a`.
- [x] T4 The simulator adapter in `apps/api`: start from persisted state, tick loop, persist, publish, retention, daily candles, `simulation.*` logs (S1, S2, S3, S5, S6). Risk item 4. Commit `603ea3c`.
- [x] T5 The control endpoints, the composition and `index.ts` wiring, the shutdown step, and `docs/07-api-spec.md` (S4, S6). Risk item 2. Commit `94ec46c`.

## Done when

A running server moves prices, appends events with gapless sequences across a restart, closes the daily candle at rollover, and only an `ADMIN` can control it.

## Risk

Items 1 (writes and deletes stored data, retention), 2 (a permission-gated control) and 4 (tick loop, restart ordering). Independent verifier: not run (no subagents in this workflow).

## Verification

pnpm typecheck, pnpm lint, pnpm test; the DB-backed suites are run by the user.

## Log

L1 (2026-10-23, the user): "PR merged, develop actualizada, haz B5-6 completo igual como hiciste B5-5"

L2 Decisions taken with the recommendation (same approval as B5.5):

- D1 `HALTED` and the `PAUSED` mode. `pause` moves to `HALTED`: the one second loop stops, nothing ticks and no candle closes; the first tick after `start` closes the missed days with generated candles. The `PAUSED` mode keeps the loop running while the engine emits nothing (candles still close at midnight). `start` resumes `RUNNING` into the mode in effect when it was paused. `PUT /mode` while `HALTED` is accepted and takes effect on `start`.
- D2 Control responses. All three answer `200 { "data": { "state": "RUNNING" | "HALTED", "mode": "<wire id>" } }`. Repeating `start` on `RUNNING` or `pause` on `HALTED` answers 200 with the unchanged status, with no log line.
- D3 The lifecycle state and the mode are not persisted: a restart is `RUNNING` in `NORMAL`.
- D4 `Position.currentPrice` is updated on every tick (one `UPDATE` per asset through `updateCurrentPriceByAssetId`), not overlaid at query time: the valuation, allocation and `dailyChange` code keeps reading `Position.currentPrice` unchanged.
- D5 Retention of `MarketEvent`: the latest 3,600 events per asset (one hour at one tick per second); every 300 ticks `pruneBeforeSequence` deletes the older ones. It never deletes the highest sequence, so `MAX(sequence)` survives a restart.
- D6 Failures. A persistence error on one asset logs `simulation.tick.failed` and skips that asset for the tick; a tick that is still running makes the next one be skipped. Neither stops the loop or the process. A skipped asset leaves a gap in its persisted sequence for that tick; the next restart resumes from the persisted maximum.
- D7 Logging. Ticks are not logged; only `simulation.started`, `simulation.paused` and `simulation.mode.changed` at `info` and failures at `warn` (answers the open detail of `08-realtime-spec.md` §58).
- D8 A restart in the middle of a UTC day: the candle of that day is built from the ticks since the restart (it opens at the price found).
- D9 The engine seed is `trading-analytics-platform:<highest persisted sequence>`. The same persisted state gives the same series, and a restart from a later point does not replay the noise of the first run.
- D10 Edit surfaces added to the list above while working: `packages/persistence-memory/src/**` (the in-memory repositories and the contract suites follow the ports), `apps/api/src/app.ts`, `apps/api/package.json` and `apps/api/tsconfig.json` (the new `@trading/market-sim` dependency and reference), and `pnpm-lock.yaml`.
- D11 Rolling the price without a tick. When a day closes and the asset does not tick in that call (mode `PAUSED`, or days generated at boot), the simulator writes `MarketPrice` with price and previous price at the close, `change` 0, and updates the held positions, so `previousPrice` rolls at every rollover (S3).

L3 Checks, observed on 2026-10-23:

- `pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm docs:check` pass.
- Tests added and passing: 23 in `market-simulator.test.ts`, 23 in `simulation.routes.test.ts`, 2 in `simulator-step.test.ts`, 4 in `simulation-service.test.ts`, 16 in `simulation.schema.test.ts`, and 8 new contract cases (event uniqueness and pruning, latest candle, position price by asset) run against the in-memory repositories (persistence-memory 306 pass, application 450 pass, contracts 216 pass).
- A mutation check on the simulator (dropping the persisted sequence and the prune interval) made the resume and retention tests fail, so they pin those rules.
- `apps/api`: 29 test files fail only because this environment has no database (same count as before this slice); none is a new file. The Prisma repositories and the migration were not run: `prisma validate` passes, but the new Prisma contract cases and the `20261023120000_make_market_event_sequence_unique` migration need the user to run `db:test:migrate` and the DB-backed suites.
- Known limit (D8): a restart in the middle of a UTC day builds that day candle from the ticks since the restart.
