# B4.5 Docs and close

Source: roadmap B4; ADR-008; `07-api-spec.md` §14-16, §39; `13-observability-spec.md` §43. Depends on: B4.1 to B4.4. Branch: `docs/close-b4`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Tasks re-verified against the code when the slice started.

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

- [x] T1 Reproduce an import end to end and record the log lines.
- [x] T2 Flip the `Planned (B4)` marks after checking each against the code.
- [x] T3 Reconcile `07-api-spec.md`, `13-observability-spec.md` and the ADR-008 header.
- [x] T4 Close B4 in the roadmap and PROGRESS.

## Done when

No `Planned (B4)` mark is stale and the import can be followed from its log.

## Risk

None (documentation only).

## Verification

pnpm docs:check.

## Log

- 2026-10-21 Decisions (recommendations approved by the user's delegation):
  - `(B4)` prefixes on acceptance criteria are block tags (the closed `(B2)` and `(B3)` tags stay), so only the `Planned (B4)` statuses were flipped, on the 10 docs that carried them. B5 and later marks were left alone.
  - Where a sentence said a value or name was "open (B4)" it now states what was built: 1 MB, 5000 rows, 5 minutes per attempt, `text/csv` body, 60-second lease, the `job.*` names and their levels. ADR-008 keeps its decisions and gains a "Resolved in B4" table.
  - T1 is a documented reproduction, not a live run: the three scenarios (success, validation failure, cancel) plus retry-after-interruption are written in `13-observability-spec.md` §75 from the events and fields the code writes and their tests assert. They were not captured against PostgreSQL because there is no test database in the authoring session; the section says so.
  - `07-api-spec.md` §14, §15, §16 and §39 match the routes (done in B4.4).
- Verification: `pnpm docs:check` passes (34 files). A scan for `Planned (B4)` finds only the PROGRESS sentence that describes the flip.
- Risk: none (documentation only).
