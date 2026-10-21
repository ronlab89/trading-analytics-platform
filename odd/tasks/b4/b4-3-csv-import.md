# B4.3 CSV import: validate and apply

Source: roadmap B4; ADR-008 points 1, 2, 10 and Deferred detail (apply re-check, archived portfolio); ADR-003, ADR-004. Depends on: B4.2. Branch: `feat/b4-3-csv-import`.

Working rules: tiny tasks, each approved by the user before any edit; no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/application/src/**
packages/contracts/src/**
apps/api/package.json
pnpm-lock.yaml
odd/tasks/b4/**

## Specs

- S1 The CSV parser is `csv-parse` (decision of the plan), with a documented column set and limits of 1 MB and 5,000 rows.
- S2 Validation checks every row (`BUY` and `SELL` only, chronological order, asset currency equal to the portfolio's) and reports every failure with its row; any failure ends the job `FAILED` with `VALIDATION_FAILED`, writes nothing and clears the stored input.
- S3 Apply writes all rows in one `UnitOfWork`, re-checks the invariants inside it and sets `COMPLETED` conditionally; a business rejection ends `APPLY_REJECTED`, a technical failure `APPLY_ERROR`.
- S4 An archived portfolio ends the job `FAILED` with `PORTFOLIO_ARCHIVED`, writes nothing and clears the stored input.
- S5 A finished job creates its notification (`SUCCESS`, `ERROR`, none for `CANCELLED`).

## Tasks

- [x] T1 Add the parser dependency and the CSV row parser with its column contract. `parseImportCsv` (application) takes an injected `CsvTokenizer`, because application may import only `@trading/domain` (ADR-001 point 1); `csv-parse` lives in `apps/api/src/import/csv-tokenizer.ts`.
- [ ] T2 Validation stage with the per-row report and progress.
- [ ] T3 Apply stage inside the `UnitOfWork`, with the conditional completion and the three failure paths.
- [ ] T4 Notifications for finished jobs.

## Done when

An import is all or nothing under validation failure, a stale `SELL`, an archived portfolio and a database failure, each pinned by a test.

## Risk

Item 1 (writes many transactions and positions at once) and item 5 (a new dependency). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test.

## Log
