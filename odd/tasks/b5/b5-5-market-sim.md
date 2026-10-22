# B5.5 Market simulation engine

Source: roadmap B5; ADR-007 points 7, 8, 14 and 15; `08-realtime-spec.md` §35 to §40; `12-demo-mode-spec.md` §37 to §40; `04-tech-stack.md` §47-48. Depends on: B4 (independent of B5.1 to B5.4). Branch: `feat/b5-5-market-sim`.

Working rules: tiny tasks, each approved by the user before any edit (or delegated for the whole slice); no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/market-sim/**
pnpm-workspace.yaml
pnpm-lock.yaml
package.json
tsconfig*.json
eslint.config.*
odd/tasks/b5/**

## Specs

- S1 `@trading/market-sim` is a pure package that depends only on `@trading/domain`: no I/O, no `Date.now()`, no `Math.random()`; time comes from an injected `Clock` and randomness from a seeded generator.
- S2 The same seed, clock and inputs produce the same sequence of prices (determinism), and a different seed a different one.
- S3 Modes `PAUSED`, `NORMAL`, `VOLATILE`, `BULLISH` and `BEARISH` and the scenarios `STABLE_MARKET`, `BULLISH_SESSION`, `VOLATILE_SESSION`, `SHARP_DRAWDOWN` and `RECOVERY` move the price as `12-demo-mode-spec.md` §37 to §40 describe; a price never goes to zero or below.
- S4 A tick returns the new price and `tickChange`, the tick-to-tick delta (ADR-007 point 14), while `change` and `changePercent` stay against the last closed daily candle.
- S5 At a UTC day rollover the engine returns the closed daily candle for each asset; given a gap of offline days it deterministically generates the missing candles so the daily series has no holes.

## Tasks

- [ ] T1 Package scaffold, workspace wiring, lint boundary (domain only) and the seeded generator.
- [ ] T2 Price step per mode, tick output and `tickChange`.
- [ ] T3 Scenarios and profiles.
- [ ] T4 Day rollover and offline-day candle generation.

## Done when

Hand-computed and property tests pin determinism, positivity, mode and scenario direction, and the candle series for an offline gap; the package has no import outside `@trading/domain`.

## Risk

Item 5 (a new workspace package changes the build and lint setup). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test, pnpm build.

## Log
