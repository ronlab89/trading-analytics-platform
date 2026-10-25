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

- [x] T1 Flip the marks and write the ADR-006 section. Commit `a9b1570`.
- [x] T2 README, CONTRIBUTING and the deployment spec runbooks. Commit `253f98b`; the runbook rows of `14` were flipped in T1.
- [x] T3 Close B7 in the roadmap and PROGRESS. Commit: the one that holds this line.

## Done when

No `Planned (B7)` mark is stale and a new developer can run the production-like stack from the README alone.

## Risk

None (documentation only).

## Verification

pnpm docs:check; Prettier on the edited docs.

## Log

L1 Request: as B7.1 (the task files for B7).
L2 Done 2026-10-25. About 190 `Planned (B7)` marks were checked against the code and flipped; none is left. Beyond the marks, the stale prose around them was fixed ("does not run today", "no Dockerfile exists", the "Open (B7)" notes), each open item with the decision B7 took. Three things differ from what the older text said and are recorded as such: (1) the `api` service runs with `NODE_ENV=production` and the seed runs from the host, so ADR-006 point 11 got an amendment in its implementation record (not a new decision); (2) the JWT secret rule has no automated test (`env.test.ts` covers `DATABASE_URL` but not `JWT_SECRET`), so `09` §55 says "checked by hand in B7.3, no automated test"; (3) `connection_limit` was never measured, so it is left unset, not tuned. The "Deferred detail assigned to B7" table of the roadmap has an Outcome column, one row each. README also lost two stale lines ("Not built yet: token refresh, CI" and "Node.js >= 22"). `pnpm docs:check` passes.
