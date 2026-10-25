# B7.4 Smoke test

Source: roadmap B7; ADR-006 point 11 ("Smoke test data"); `14-deployment-spec.md` §49 and the readiness note at its health section. Depends on: B7.3. Branch: `feat/b7-4-smoke-test`.

Working rules: as B7.1.

## Allowed edit surfaces

scripts/**
package.json
docs/**
README.md
odd/tasks/b7/**

## Specs

- S1 One script runs after `docker compose --profile full up`, with no frontend step (roadmap B7).
- S2 The stack runs with `NODE_ENV` other than `production`; the script runs `db:seed` as an explicit step before it logs in. Running the seed with `NODE_ENV=production` is still refused (B0 guard untouched, ADR-006 point 11).
- S3 The script waits for `GET /health/ready`, logs in with the seeded user, and calls a route that reads a table, because readiness only proves `SELECT 1` and not that migrations were applied (`14` §49 note).
- S4 It exits non-zero with a message naming the failed step, and prints nothing secret.
- S5 It is exposed as a root script (for example `pnpm smoke`) and works on Windows, macOS and Linux (decision D1).

## Decisions to approve

- D1 Recommended: a Node script (`scripts/smoke.mjs`) using `fetch`, like `scripts/check-docs.mjs`, instead of a shell script; the repository is developed on Windows.
- D2 Recommended: the script does not start or stop the stack; it expects it running and documents the three commands (up, seed, smoke). A separate task could wrap them if the manual flow proves error-prone.
- D3 Recommended: CI does not run it in this block (roadmap B7 note: "CI is not part of this block"). Adding it later is a new decision.

## Tasks

- [x] T1 RED: a small test of the script's step runner (a failing step stops the run and names itself).
- [x] T2 The script: readiness wait, seed step, login, table-reading route.
- [x] T3 Run it against the B7.3 stack, including one forced failure (stop the API) to see the message.
- [x] T4 Docs: `14` §49 marks and README commands.

## Done when

From a clean volume, `up`, `db:seed` and the smoke script pass, and a stopped API makes the script fail with the right step name.

## Risk

Item 5 (delivery or environment: a new script others run). Item 2 is avoided by reading credentials from the same env vars as the seed.

## Verification

The three-command flow on a clean volume; the forced failure; pnpm lint; pnpm test; pnpm docs:check.

## Log

L1 Request: as B7.1 (the task files for B7).
L3 Done 2026-10-25. D1 to D3 approved as recommended. S2 says the script runs `db:seed`; D2 says it documents three commands. D2 won: `up`, `db:seed`, `smoke`, so the script stays free of child processes and `pnpm` on Windows. Its messages point at the seed command when the login is refused or no rows come back.
L4 T1 and T2 share one commit: the RED (module not found) was observed first, the 11 tests then pass and `pnpm test:scripts` runs 42 in total. Verified in an isolated project (`-p b74`, removed afterwards): fail at `login` before the seed, pass (4 steps) after it, fail at `readiness` with the API stopped. The seed ran through `docker compose run migrate` because Compose reads the user's `.env` for the runtime password, which the assistant does not read; the documented host command is `pnpm --filter @trading/database db:seed`.
