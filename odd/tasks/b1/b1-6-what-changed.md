# B1.6 What Changed read model

Source: roadmap B1 (`docs/BACKEND-ROADMAP.md`), lines 274 to 276; ADR-010 point 1; FR-006. Depends on: B1.2. Branch: `feat/b1-6-what-changed`.

The read model is built in the application layer and returned as a field of the overview response, not as its own endpoint (decided 2026-10-08). Its shape is defined in this block: read ADR-010 point 1 before slicing the tasks below.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

## Allowed edit surfaces

packages/domain/src/**
packages/application/src/**
packages/contracts/src/**
apps/api/src/**
docs/07-api-spec.md
docs/BACKEND-ROADMAP.md
docs/PROGRESS.md

## Specs

- S1 The overview carries `whatChanged` for the fixed period `1M`, with the same `asOf`, `effectiveFrom` and `status` as `performance` (`07-api-spec.md` §11).
- S2 `contributor` and `detractor` are the largest positive and largest negative contribution of the range attribution. "When contributions are all `≥ 0` there is no detractor, and when they are all `≤ 0` there is no contributor." A tie goes to the alphabetically first symbol.
- S3 `events` are `POSITION_OPENED` (quantity goes from 0 to above 0) and `POSITION_CLOSED` (quantity reaches 0), measured at the end of each day after the baseline, ordered by date and then by symbol. "One that opens and closes in the period produces both events, in date order."
- S4 "An empty portfolio, or a period with no events, returns an empty list (not an error)." No number is fabricated: `null` or empty instead.
- S5 Alerts triggered in the period are not in this version: there is no data source yet.

## Tasks

- [x] T1 Define the shape from ADR-010 point 1 and FR-006, confirmed with the user, and write it in `07-api-spec.md` §11.
- [x] T2a Pure domain function: largest contributor and detractor (S2).
- [x] T2b Pure domain function: position opened and closed events (S3).
- [x] T3a Response schema and presenter, and `whatChanged` in the overview response.
- [x] T3b `overview-service.ts` builds `whatChanged` from the same `1M` series as `performance`.
- [x] T4 API integration test and reconciliation of `07-api-spec.md`, roadmap and PROGRESS.

## Done when

The overview carries the What Changed field; no number is fabricated (absent or `UNKNOWN` instead); `07-api-spec.md` agrees.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.

## Log

- L1 (user request, B1 roadmap): "The What Changed read model (ADR-010 point 1, FR-006), built in the application layer and returned as a field of the overview response, not as its own endpoint (decided 2026-10-08; its shape is defined in B1)."
- 2026-10-17: the shape was proposed and confirmed with the user. Alerts triggered in the period stay out of this version because nothing persists a trigger yet (`lastTriggeredAt` and the evaluation are planned, roadmap lines 526 to 578). The ADR-010 rules moved here from B1.5 (ties by symbol, both events for a position that opens and closes).
- FR-006 in `02-functional-requirements.md` is outside the edit surfaces; its status and the alerts note go in the docs pass at the end of B1, with FR-085.
- `RangeAttribution` gained a `baseline` field (the day the P/L starts from) because the events need it: with only `effectiveFrom` an unclamped and a clamped period cannot be told apart. Additive; the attribution endpoint ignores it.
- With `INSUFFICIENT_DATA` the events are `[]` too (there is no baseline), not only the contributor and the detractor; `07-api-spec.md` §11 says so.
- `overview-service.ts` builds one `1M` series and shares it between `performance` and `whatChanged`; the asset lookup also takes the assets of the series, so a position closed before today keeps its symbol.
- The API test seeds a tie (a closed position and a held one both gain 10) so the symbol rule is pinned end to end.
