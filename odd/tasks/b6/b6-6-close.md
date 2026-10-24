# B6.6 Docs and close

Source: roadmap B6; ADR-002 point 7. Depends on: B6.1 to B6.5. Branch: `docs/close-b6`.

Working rules: as B6.1.

## Allowed edit surfaces

docs/**
README.md
odd/tasks/b6/**

## Specs

- S1 Every `Planned (B6)` mark is checked against the code and flipped to `Implemented`; marks for FE and later stay.
- S2 ADR-002 records what B6 built (where the operations live, how the document is generated, how drift is caught) and `04-tech-stack.md` §21 answers its open detail: the document is served by the API behind `API_DOCS_ENABLED`, viewed with Scalar.
- S3 `07-api-spec.md` §57 says how to open the viewer and how to add an endpoint (add the operation, or the drift test fails).
- S4 The roadmap status row and `PROGRESS.md` say B6 is done and B7 is next.

## Tasks

- [ ] T1 Flip the `Planned (B6)` marks and write the ADR-002 section.
- [ ] T2 §57, §21 and the README line for the viewer.
- [ ] T3 Close B6 in the roadmap and PROGRESS.

## Done when

No `Planned (B6)` mark is stale and a new developer can open the docs and know how to keep them in step.

## Risk

None (documentation only).

## Verification

pnpm docs:check.

## Log
