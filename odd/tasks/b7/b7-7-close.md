# B7.7 Docs and close

Source: roadmap B7; ADR-006. Depends on: B7.1 to B7.6. Branch: `docs/close-b7`.

Working rules: as B7.1.

## Allowed edit surfaces

docs/**
README.md
CONTRIBUTING.md
odd/tasks/b7/**

## Specs

- S1 Every `Planned (B7)` mark is checked against the code and flipped to `Implemented`; marks for FE and later stay.
- S2 ADR-006 records what B7 built (build path, image, profile, smoke test) and the decisions taken (D1 to D3 of each slice).
- S3 The stale cross-references the roadmap lists for B7 are settled, and the "Deferred detail assigned to B7" table is closed row by row.
- S4 The roadmap status row and `PROGRESS.md` say B7 is done and the frontend stage is next.
- S5 README and CONTRIBUTING say how to build the image, start each profile and run the smoke test.

## Tasks

- [ ] T1 Flip the marks and write the ADR-006 section.
- [ ] T2 README, CONTRIBUTING and the deployment spec runbooks.
- [ ] T3 Close B7 in the roadmap and PROGRESS.

## Done when

No `Planned (B7)` mark is stale and a new developer can run the production-like stack from the README alone.

## Risk

None (documentation only).

## Verification

pnpm docs:check; Prettier on the edited docs.

## Log

L1 Request: as B7.1 (the task files for B7).
