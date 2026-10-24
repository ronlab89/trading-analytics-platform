# B6.3 Operations: auth, assets, market, analytics, overview, watchlist, alerts, notifications, preferences, simulation, health

Source: roadmap B6; ADR-002 point 7; `07-api-spec.md`. Depends on: B6.2. Branch: `feat/b6-3-operations-rest`. Test runner: Vitest.

Working rules: as B6.1.

Provisional: re-verified against the routes when the slice starts.

## Allowed edit surfaces

packages/contracts/src/**
odd/tasks/b6/**

## Specs

- S1 Every remaining HTTP endpoint has an `ApiOperation` built the way B6.2 does: `auth` (login, refresh, logout, with the refresh cookie), `assets`, `market`, the analytics and overview reads, `watchlist`, `alerts`, `notifications`, `preferences`, `simulation` (with the `simulation:control` permission in the description) and `health`.
- S2 Public endpoints (login, refresh, health) are marked as not needing the bearer token; every other one requires it.
- S3 Together with B6.2, the operations cover every route mounted by `createApp()`. This slice does not add the test that proves it (B6.4).
- S4 The WebSocket is not an HTTP operation and is not in the document; the description points to `08-realtime-spec.md`.

## Tasks

- [ ] T1 Auth, assets and market.
- [ ] T2 Analytics, overview, watchlist and preferences.
- [ ] T3 Alerts, notifications, simulation and health.

## Done when

The document describes every HTTP endpoint with request and response schemas.

## Risk

None expected (data only).

## Verification

pnpm --filter @trading/contracts test, pnpm typecheck, pnpm lint.

## Log
