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
- [x] T2 Validation stage with the per-row report and progress. `createCsvImportHandler().validate`: report in tiers (format, then row rules against assets/currency/transaction rules, then the chronological check only when the earlier tiers are clean); progress every 100 rows.
- [x] T3 Apply stage inside the `UnitOfWork`, with the conditional completion and the three failure paths. `apply` reads the portfolio status first thing inside the unit (through the portfolio repository: the unit carries no portfolio repository), locks assets in id order, writes rows in date order, replays positions, and completes the job through `context.complete`.
- [x] T4 Notifications for finished jobs. `createJobNotifier` (SUCCESS for COMPLETED, ERROR for FAILED and TIMED_OUT, none for CANCELLED); the runner calls it after each winning transition, and a notification that fails is logged as `job.notification_failed` and never fails the job.

## Done when

An import is all or nothing under validation failure, a stale `SELL`, an archived portfolio and a database failure, each pinned by a test.

## Risk

Item 1 (writes many transactions and positions at once) and item 5 (a new dependency). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test.

## Log

- 2026-10-21: the user asked for B4.3 complete with the same terms as B4.2. Decisions taken: `csv-parse` lives in `apps/api` and `application` takes an injected `CsvTokenizer`, because the lint rule (ADR-001 point 1) lets `application` import only `@trading/domain`; `row` is the editor line (header is row 1, row 0 is the file); the validation reports in tiers and runs the chronological check only when the format and row tiers are clean; the archived-portfolio check reads the portfolio through its repository first thing inside the unit of work (the unit carries no portfolio repository, and adding one would change `TransactionalRepositories` again), so it has the same small window as `createTransaction`; the notification messages are fixed English texts per failure reason.
- 2026-10-21: wiring the runner, the CSV handler, the notifier and the jobs shutdown step into `apps/api/src/index.ts` and `composition.ts` moves to B4.4 T3 (the imports route is its first caller). No independent verifier ran (risk items 1 and 5) because of the no-subagents rule. The Prisma-backed paths were not run here (no test database).
