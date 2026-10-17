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

## Tasks

- [ ] T1 Define the shape from ADR-010 point 1 and FR-006 (to be confirmed with the user before any code).
- [ ] T2 Pure domain function that builds the read model, with hand-computed tests.
- [ ] T3 Response schema and presenter, and the field in the overview.
- [ ] T4 API integration test and `07-api-spec.md` reconciliation.

## Done when

The overview carries the What Changed field; no number is fabricated (absent or `UNKNOWN` instead); `07-api-spec.md` agrees.

## Verification

pnpm --filter @trading/domain test; pnpm --filter @trading/application test; pnpm --filter @trading/contracts test; pnpm --filter @trading/api test; pnpm typecheck; pnpm lint.
