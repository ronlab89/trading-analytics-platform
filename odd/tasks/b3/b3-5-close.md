# B3.5 Docs and close

Source: roadmap B3 (`docs/BACKEND-ROADMAP.md`); `docs/13-observability-spec.md` §36, §74, §75; ADR-009. Depends on: B3.1 to B3.4. Branch: `docs/close-b3`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

docs/**
odd/tasks/b3/**

## Specs

- S1 Every `Planned (B3)` mark in `docs/` is checked against the code and flipped to `Implemented` with its block reference; B4 and B5 marks stay.
- S2 The B3 items of the `13-observability-spec.md` §74 checklist are checked, and the local observability workflow, log levels and troubleshooting workflow (§36) are documented.
- S3 A reproduced failure answers the questions of `13-observability-spec.md` §75 that B3 owns (1, 2, 3, 4, 5 and 8), recorded as the review result.
- S4 The ADR-009 header no longer says `auth.logout` lands in B2; the event landed in B3.
- S5 The roadmap status row and `PROGRESS.md` say B3 is done and B4 is next.

## Tasks

- [ ] T1 Reproduce one failure locally and answer the §75 questions from the logs; record the result.
- [ ] T2 Flip the `Planned (B3)` marks after checking each against the code.
- [ ] T3 Check the §74 items and write the workflow, levels and troubleshooting docs.
- [ ] T4 Fix the ADR-009 header, close B3 in the roadmap and PROGRESS.

## Done when

The §75 questions owned by B3 are answerable from a reproduced failure, and no `Planned (B3)` mark is stale.

## Risk

None (documentation only), unless the review finds a defect, which becomes its own slice.

## Verification

pnpm docs:check.

## Log

- Created from the B3 plan approved by the user on 2026-10-19.
