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

- [x] T1 Auth, assets and market (9 operations). Builder gained cookies and other responses first (d894b64); operations in 6853411.
- [x] T2 Analytics, overview, watchlist and preferences (10 operations), 8aab86b.
- [x] T3 Alerts, notifications, simulation and health (14 operations), 8f3574e.

## Done when

The document describes every HTTP endpoint with request and response schemas.

## Risk

None expected (data only).

## Verification

pnpm --filter @trading/contracts test, pnpm typecheck, pnpm lint.

## Log

L1 Request: "PR merged y develop actualizada, haz B6-3" (the plan was approved with the decisions taken from the recommendations)
L2 Decisions taken with the recommendation:

- D1 `ApiOperation` gained `cookies` (the `refresh_token` cookie of refresh and logout) and `otherResponses` (the 503 of the readiness check, which has the same body as the 200). The login answer documents the `Set-Cookie` success header.
- D2 The service endpoints answer without the `{ data }` envelope, so `health.response.ts` gives them their own schemas in `@trading/contracts`. `apps/api/src/routes/health.contract.test.ts` validates the real answers (200, 503 database down, 503 shutting down) against them. No route or presenter changed.
- D3 `/`, `/health` and `/health/ready` use the tag "Health", have no security requirement and are exempt from the `/api/v1` path rule in `operations.test.ts`. The 401 rule now allows 401 on public operations (login answers it for bad credentials) and the 400 rule counts only params, query and body, not headers.
- D4 The registry holds 58 operations: the 55 routes of the routers plus the 3 service endpoints. `rest-operations.test.ts` pins this count and the public ones.
- D5 The attribution endpoint answers two shapes (current state, or over a range); it is documented as a union of both response schemas. Preferences answer `data: null` until the first save.
- D6 S4: the WebSocket is not an operation and is not in the document. The pointer to `08-realtime-spec.md` belongs to the document description, which B6.5 writes when it serves the viewer.
- D7 Only `PRICE` alerts are evaluated by the server; the description says so and the other types are stored only.
- Checks: contracts 259 tests pass; `tsc` and ESLint clean on `packages/contracts` and on the new `apps/api` test; the new `apps/api` test passes (5 tests) with the example test env. DB-backed suites were not run here (no database).
- Risk: none (data and tests; no route, presenter or shared code changed).
