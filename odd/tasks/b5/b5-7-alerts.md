# B5.7 Edge-triggered alerts

Source: roadmap B5; ADR-007 points 9 and 15; `08-realtime-spec.md` §22; `12-demo-mode-spec.md` §45; FR-053. Depends on: B5.4 and B5.6. Branch: `feat/b5-7-alerts`. Test runner: Vitest (`pnpm --filter <package> test`).

Working rules: the user approved the whole slice at once ("haz B5-7"), with the decisions below taken from the recommendations; one commit per task; no subagents; push and PR stay with the user.

## Allowed edit surfaces

packages/domain/src/**
packages/application/src/**
packages/persistence-memory/src/**
packages/database/**
packages/contracts/src/**
apps/api/src/simulation/**
apps/api/src/composition.ts
apps/api/src/logging/events.ts
docs/05-data-model.md
docs/07-api-spec.md
odd/tasks/b5/**

## Specs

- S1 Alerts are evaluated on every tick, but an alert fires when its condition changes from false to true and re-arms when it becomes false again; it never repeats on every tick.
- S2 `armed` and `lastTriggeredAt` are persisted in the same transaction as the notification it creates; a re-arm needs a hysteresis band or a cooldown, decided here and recorded.
- S3 The initial state of a new alert whose condition is already true is defined and recorded (it does not fire on creation unless the Log says otherwise).
- S4 A trigger creates a notification, then publishes `ALERT_TRIGGERED` and `NOTIFICATION_CREATED` on `notifications` for the alert's owner, after the commit.
- S5 Existing alert endpoints behave as before; the new columns have safe defaults for stored rows.

## Tasks

The roadmap tasks were split against the code when the slice started (L2).

- [x] T1 Domain: `armed` and `lastTriggeredAt` on `Alert`, and the edge rule as pure functions (S1, S2, S3). Inline. Commit `630c015`. 14 new tests; a mutation (armed check inverted) fails 7 evaluator tests.
- [ ] T2 Persistence: migration for `armed` and `lastTriggeredAt` (with the baseline of stored alerts), repositories, contract suites, and `alerts` and `notifications` inside the unit of work (S2, S5). Risk item 1. Inline. Commit `75cfc5c`. New contract cases (explicit `armed`, edge-trigger update, `listEnabledByAssetIds`) and two unit-of-work cases (rollback and commit of an alert update with its notification). `prisma validate` passes; the Prisma suites and the migration were not run (no database).
- [x] T3 Application: `createAlertEvaluator` (one transaction per trigger, publish after the commit) and the baseline at create and update (S1, S2, S3, S4). Risk item 4. Inline. Commit `a5d63f5`. 9 evaluator tests and 5 baseline tests in the alert service.
- [x] T4 The simulator calls the evaluator on every tick; composition, log events and docs (S1, S4). Inline. Commit `d3e9b30`. 2 simulator tests (once per tick with the stored ticks only; a rejecting evaluator does not stop the ticks).

## Done when

A price crossing a threshold fires exactly once, stays quiet while it remains true, fires again only after re-arming, and survives a restart without a duplicate.

## Risk

Items 1 (a migration over stored alerts) and 4 (evaluation races with ticks). Independent verifier: not run (no subagents in this workflow).

## Verification

Observed: `pnpm build`, `pnpm typecheck`, `pnpm lint` and `pnpm docs:check` pass; `domain`, `application`, `contracts` and `persistence-memory` tests pass; the simulator tests pass with a dummy `DATABASE_URL`. Not green here: `alerts.routes.test.ts` and the Prisma suites fail only for lack of a database. Native review (lenses risk, resilience, reliability) against `develop`: approved and acknowledged, one non-blocking warning (D10).

## Log

L1 (2026-10-23, the user): "PR merged, develop actualizada, haz B5-7"

L2 Decisions taken with the recommendation (same approval as B5.5 and B5.6):

- D1 What is evaluated. Only `PRICE` alerts that have an `assetId` and the condition `ABOVE` or `BELOW` (upper case). Other types (`PORTFOLIO_CHANGE`, `ALLOCATION`, `VOLATILITY`) and other condition strings are stored and listed as before but never fire: no tick data feeds them yet.
- D2 Comparison. `ABOVE` is true when the price is strictly greater than the threshold and `BELOW` when it is strictly lower, so a price equal to the threshold is not a crossing. The `Float` threshold is turned into `Money` in the currency of the price before comparing.
- D3 Re-arm by hysteresis, no cooldown. A fired alert (`armed = false`) re-arms when the price moves back past the threshold by 0.5% (`ALERT_REARM_BAND`): `ABOVE` re-arms at a price at or below `threshold * 0.995`, `BELOW` at or above `threshold * 1.005`. Between the threshold and the band it stays quiet, so a price oscillating around the threshold fires once.
- D4 Initial state. A new alert whose condition is already true is created with `armed = false`: it does not fire on creation and re-arms by D3. Editing the condition, the threshold or `enabled` computes the state again from the current price the same way. When there is no `MarketPrice` yet the alert is created armed.
- D5 Stored rows. The migration adds `armed` (default `true`) and `last_triggered_at` (nullable), then sets `armed = false` on the stored `PRICE` alerts whose condition is already true against `market_prices`, so deploying does not fire them.
- D6 One transaction per trigger. Inside it the alert is read again and, if it is still enabled and armed, `armed` and `lastTriggeredAt` are written together with a `WARNING` notification of type `ALERT_TRIGGERED` (the unit of work gets `alerts` and `notifications`). `ALERT_TRIGGERED` and `NOTIFICATION_CREATED` are published after the commit through `publishQuietly`. A re-arm is a single update without a notification.
- D7 The wire is unchanged. `armed` and `lastTriggeredAt` are not part of the alert response (S5).
- D8 Failure. An evaluation error is logged as `alert.evaluation_failed` and never stops the tick: the price, the event and the publication of the tick have already happened.
- D9 Logging. `alert.triggered` at `info` with the alert, user and asset ids (no user data beyond ids); re-arms are not logged.
- D10 Review warning, left as is: an alert whose stored `threshold` cannot become a `Money` (a non-finite float) makes the whole evaluation of that tick fail and be logged as `alert.evaluation_failed`, instead of skipping only that alert. The request schema rejects such values, so it needs a row written by hand.
