# B4.5 Docs and close

Source: roadmap B4; ADR-008; `07-api-spec.md` §14-16, §39; `13-observability-spec.md` §43. Depends on: B4.1 to B4.4. Branch: `docs/close-b4`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

docs/**
odd/tasks/b4/**

## Specs

- S1 Every `Planned (B4)` mark is checked against the code and flipped to `Implemented`; B5 and later marks stay.
- S2 `07-api-spec.md` §14 loses the asynchronous transaction flow and §15, §16 and §39 match the routes.
- S3 The ADR-008 header and its Deferred detail table say what landed; the new FR for CSV import is in `02-functional-requirements.md`.
- S4 A reproduced run of an import (success, validation failure and cancel) answers how a developer follows a job in the log.
- S5 The roadmap status row and `PROGRESS.md` say B4 is done and B5 is next.

## Tasks

- [ ] T1 Reproduce an import end to end and record the log lines.
- [ ] T2 Flip the `Planned (B4)` marks after checking each against the code.
- [ ] T3 Reconcile `07-api-spec.md`, `13-observability-spec.md` and the ADR-008 header.
- [ ] T4 Close B4 in the roadmap and PROGRESS.

## Done when

No `Planned (B4)` mark is stale and the import can be followed from its log.

## Risk

None (documentation only).

## Verification

pnpm docs:check.

## Log
