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

- [x] T1 Flip the `Planned (B6)` marks and write the ADR-002 section, 3c64988.
- [x] T2 §57, §21 and the README line for the viewer, dc92f3f.
- [x] T3 Close B6 in the roadmap and PROGRESS (roadmap status row and header, PROGRESS "Next").

## Done when

No `Planned (B6)` mark is stale and a new developer can open the docs and know how to keep them in step.

## Risk

None (documentation only).

## Verification

pnpm docs:check.

## Log

L1 Request: "PR merged y develop actualizada, haz B6-6, ya abrio bien la documentacion de scalar en el browser" (the plan was approved with the decisions taken from the recommendations)
L2 Decisions taken with the recommendation:

- D1 The user opened the Scalar viewer in a browser and it worked, which closes the manual check B6.5 left open (T3 of B6.5).
- D2 Every `Planned (B6)` mark was flipped to `Implemented` (B6) in 00, 04, 06, 07, 10, 14 and 15; each one is about the generated document, which B6.1 to B6.5 built and tested. Marks for B0 and FE on the same lines were left as they were.
- D3 ADR-002 gained a "Resolved in B6" section (where the operations live, schemas, generation, drift test, serving, what is outside the document). It says what is not covered: the drift test does not compare headers, cookies, response schemas or status codes, and generated examples are `Deferred`. The roadmap scope mentioned examples; none were built.
- D4 `04-tech-stack.md` §21 answers its open detail (served by the API behind `API_DOCS_ENABLED`, viewed with Scalar); §57 of `07-api-spec.md` says how to open the viewer and how to add an endpoint; the README names the two URLs.
- D5 The "Last updated" line of `PROGRESS.md` was not changed, because it dates the reconciliation of §1 and §2, which this slice did not redo.
- D6 `.env.example` still lacks the two commented lines of B6.5 D7 (blocked for the assistant).
- Checks: `pnpm docs:check` passes (34 files); Prettier passes on the edited docs.
- Risk: none (documentation only).
