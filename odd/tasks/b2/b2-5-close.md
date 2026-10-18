# B2.5 Security review and close

Source: roadmap B2 (`docs/BACKEND-ROADMAP.md`); `docs/15-implementation-plan.md` §33; `docs/09-security-spec.md`. Depends on: B2.1 to B2.4. Branch: `docs/close-b2`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

docs/**
odd/tasks/b2/**

## Specs

- S1 The auth-focused security review (decided 2026-10-08) covers sessions, roles, permissions and token handling, against the checks of `15-implementation-plan.md` §33 that concern them. B7 owns the final pass.
- S2 The SDD role model is reconciled.

## Tasks

- [ ] T1 Run the review against the §33 checks and record each result.
- [ ] T2 Flip the `Planned (B2)` marks across the docs, after checking each against the code.
- [ ] T3 Close B2 in the roadmap and PROGRESS.

## Done when

The review is recorded, the role model is reconciled and no `Planned (B2)` mark is stale.

## Risk

None (documentation only), unless the review finds a defect, which becomes its own slice.

## Verification

pnpm docs:check.

## Log

- Created from the B2 plan approved by the user on 2026-10-17.
