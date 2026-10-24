# B7.6 Final security pass

Source: roadmap B7 (security checklist and final pass, decided 2026-10-08); `15-implementation-plan.md` §33; `14-deployment-spec.md` §78; ADR-006 point 9; ADR-009. Depends on: B7.1 to B7.4 (the pass runs over the finished stack). Branch: `docs/b7-6-security-pass`, then fix branches if a finding needs code.

Working rules: as B7.1. The pass reads code and tests, not the docs, as in B2.5.

## Allowed edit surfaces

docs/**
odd/tasks/b7/**

## Specs

- S1 The checklist of `15` §33 is walked over the whole backend, one row per area, each with the evidence (file, test or command) and a verdict: Meets, Meets with a note, or Does not meet.
- S2 The §78 areas are covered explicitly: secrets, CORS, headers, error exposure, health output, resource limits.
- S3 B2.5 covered sessions, roles, permissions and token handling; this pass does not repeat that review, it only links to it.
- S4 Every "Does not meet" becomes a finding with an owner: fixed in this block as its own small task, or recorded as `Deferred` with the reason.
- S5 The database recovery entry is decided: version 1 has none, because readiness is stateless (ADR-009); the decision is re-stated now that the healthcheck exists.
- S6 Backups are documented as not applicable to a local environment, not claimed (ADR-006 point 9).

## Tasks

- [ ] T1 Walk §33 and §78 read-only and write the review table in this file.
- [ ] T2 Present the findings; fixes the user approves become their own tasks (T3.. in this file) with RED tests.
- [ ] T3 Docs: the recovery-entry decision, the backups statement, and the checklist ticked with evidence in `14`.

## Done when

Every row of §33 and §78 has a verdict with evidence, and no "Does not meet" is left without an owner.

## Risk

None for the review itself; each fix names its own item (probably 2).

## Verification

Each verdict cites a file or a command that was run; pnpm docs:check.

## Log

L1 Request: as B7.1 (the task files for B7).
