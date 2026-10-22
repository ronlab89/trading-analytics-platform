# B5.7 Edge-triggered alerts

Source: roadmap B5; ADR-007 points 9 and 15; `08-realtime-spec.md` §22; `12-demo-mode-spec.md` §45; FR-053. Depends on: B5.4 and B5.6. Branch: `feat/b5-7-alerts`.

Working rules: tiny tasks, each approved by the user before any edit (or delegated for the whole slice); no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/domain/src/**
packages/application/src/**
packages/persistence-memory/src/**
packages/database/**
packages/contracts/src/**
apps/api/src/simulation/**
apps/api/src/composition.ts
odd/tasks/b5/**

## Specs

- S1 Alerts are evaluated on every tick, but an alert fires when its condition changes from false to true and re-arms when it becomes false again; it never repeats on every tick.
- S2 `armed` and `lastTriggeredAt` are persisted in the same transaction as the notification it creates; a re-arm needs a hysteresis band or a cooldown, decided here and recorded.
- S3 The initial state of a new alert whose condition is already true is defined and recorded (it does not fire on creation unless the Log says otherwise).
- S4 A trigger creates a notification, then publishes `ALERT_TRIGGERED` and `NOTIFICATION_CREATED` on `notifications` for the alert's owner, after the commit.
- S5 Existing alert endpoints behave as before; the new columns have safe defaults for stored rows.

## Tasks

- [ ] T1 Domain rule: edge detection, re-arm and the initial state, as pure functions.
- [ ] T2 Persistence: migration for `armed` and `lastTriggeredAt`, repositories and contract suites.
- [ ] T3 Evaluation service wired to the tick, one transaction per trigger.
- [ ] T4 Publishing after the commit and the `ALERT_TRIGGERED` payload.

## Done when

A price crossing a threshold fires exactly once, stays quiet while it remains true, fires again only after re-arming, and survives a restart without a duplicate.

## Risk

Items 1 (a migration over stored alerts) and 4 (evaluation races with ticks). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test; the DB-backed suites are run by the user.

## Log
