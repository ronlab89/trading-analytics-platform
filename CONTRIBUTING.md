# Contributing Guide

This document defines how work is organized, branched, committed, and merged in this repository.

This project is developed by a single engineer as a portfolio piece, but follows a
professional workflow intentionally — as evidence of engineering discipline, not
as ceremony for its own sake. Every rule below exists for a concrete reason, in
line with the project's own principle (see `docs/03-non-functional-requirements.md`,
NFR-070): avoid complexity — including process complexity — that isn't justified.

---

## 1. Branching Model

This repository uses a simplified GitHub Flow with an integration branch:

```text
main        → holds milestone releases, protected, clean history (merge commit from develop)
develop     → integration branch, base of every PR
feat/*      → new functionality, merged into develop via PR (merge commit)
fix/*       → bug fixes, merged into develop via PR (merge commit)
docs/*      → documentation-only changes
chore/*     → tooling, configuration, dependencies
```

### Branch naming

```text
feat/portfolio-crud
feat/transaction-form
fix/transaction-validation
docs/update-data-model
chore/eslint-prettier-setup
```

Use short, kebab-case, descriptive names. Avoid vague names like `feat/updates`
or `fix/bug`.

### What is intentionally NOT used

- `release/*` branches — no coordinated release windows or team to justify them.
- Separate `staging`/`production` branches — `develop` is the integration branch;
  `main` holds milestone releases.

If the project's needs change (e.g. a team joins, or coordinated releases become
necessary), this document should be updated explicitly rather than silently
diverging from it — consistent with how the SDD documents themselves are
maintained (see `docs/00-overview.md`, §14).

---

## 2. Branch Protection Rules

| Branch                                 | Protected     | Merge allowed from                          | Requires CI green |
| -------------------------------------- | ------------- | ------------------------------------------- | ----------------- |
| `main`                                 | Yes           | `develop` only (PR)                         | Yes               |
| `develop`                              | Yes (minimum) | `feat/*`, `fix/*`, `docs/*`, `chore/*` (PR) | Yes               |
| `feat/*`, `fix/*`, `docs/*`, `chore/*` | No            | —                                           | —                 |

CI is `Implemented` (ADR-006 points 10 and 11): one GitHub Actions workflow,
`.github/workflows/ci.yml`, runs on pushes and pull requests to `develop` and
`main`, with:

- install with the lockfile
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm test:scripts` (the fixture tests of `scripts/check-docs.mjs`)
- `pnpm test` (the domain, database and API suites; the latter two run against a
  PostgreSQL service container)
- `pnpm build`

There is no coverage threshold and no continuous deployment. The CI test database
still connects with the container superuser; the runtime and migration roles of
ADR-005 point 13 are `Planned (B0)`. The branch protection rules themselves are
GitHub settings and cannot be verified from the repository. Run the same
commands locally before opening a PR (see section 9).

---

## 3. When Does `develop` Go to `main`?

Not after every feature. `develop → main` happens when a **milestone** from
`docs/15-implementation-plan.md` (§52–59) is closed — so that `main` always
reflects a coherent, demonstrable state of the project rather than incremental noise.

---

## 4. Merge Strategy

- **`feat/*`, `fix/*`, `docs/*`, `chore/*` → `develop`**: **Merge commit** (no
  squash). The branch's work-unit commits stay on `develop`, so each one remains
  reviewable and bisectable, and the merge commit marks where the pull request
  landed. This is the practice the history already shows (decided 2026-10-08, see
  section 12).
- **`develop` → `main`**: **Merge commit** (no squash).
  This preserves the fact that this point represents an actual milestone/release,
  not just another commit.

---

## 5. Pull Requests

Pull requests are used even though there is a single contributor, for two concrete reasons:

1. **Reviewable commit history** — each branch is built from coherent work-unit
   commits (section 6), so merging them as they are keeps `develop`/`main` readable
   without "wip", "fix typo", "oops" commits; fix those up on the branch before
   the pull request is merged.
2. **Real CI gate** — a PR cannot merge if the pipeline fails, which is enforced
   evidence of engineering discipline, not just a claim in a README.

Every PR targets `develop` (a `develop` → `main` PR is opened only at a milestone
boundary, see section 3). Every PR description should briefly state:

- What changed and why
- Which part of the SDD it implements (if applicable)
- How it was verified (tests run, manual check, etc.)

---

## 6. Commit Message Convention

Conventional Commits format:

```text
type(scope): description
```

### Types

```text
feat      new functionality
fix       bug fix
refactor  code change that neither fixes a bug nor adds a feature
test      adding or correcting tests
docs      documentation only
chore     tooling, config, dependencies, maintenance
build     build system or external dependency changes
ci        CI configuration changes
style     formatting-only change with no effect on behavior (whitespace, ordering)
```

`style` is an accepted type (decided 2026-10-08, see section 12); the history
already contains `style(...)` commits.

### Rules

- `scope` is short and relevant (e.g. `repo`, `domain`, `portfolio`, `api`, `demo`, `deps`)
- `description` is lowercase, imperative mood, no trailing period
- Unrelated changes are split into separate commits rather than one generic commit

### Examples

```text
feat(portfolio): add portfolio creation form
fix(transactions): handle zero-quantity validation
docs(contributing): add branching and commit conventions
chore(deps): upgrade typescript to 7.0.2
```

---

## 7. Working Process Per Step

This project is implemented in small, approved vertical slices (see project
working agreement / `docs/PROGRESS.md`). The typical flow for a step is:

```text
1. Open a branch from develop (feat/*, fix/*, docs/*, chore/*)
2. Implement the approved step
3. Verify against the step's acceptance criteria (section 9 lists the commands)
4. Commit(s) following the convention above
5. Push and open a PR into develop
6. CI runs (see section 2)
7. Merge into develop (merge commit, per section 4)
8. Delete the feature branch
```

At milestone boundaries, a PR from `develop` into `main` is opened and merged
(merge commit), and `docs/PROGRESS.md` is updated accordingly.

---

## 8. Relationship to Project Documentation

- **`docs/00-*.md` through `docs/15-*.md`, plus `docs/16-analytics-spec.md`,** define _what_ is being built (product,
  architecture, requirements).
- **`docs/adr/`** holds the Architecture Decision Records. They have the highest
  precedence: when an SDD document disagrees with an accepted ADR, the document is
  corrected (see `docs/README.md`).
- **This file** defines _how_ the work is organized and delivered.
- **`docs/PROGRESS.md`** tracks _current state_ between work sessions —
  phase, step, what's done, what's next. It links back here rather than repeating
  workflow rules.

---

## 9. Local Setup and Quality Commands

Prerequisites (as declared in `package.json`): Node.js `>=24.0.0` and pnpm `>=9.0.0`;
the repository pins `packageManager` to `pnpm@12.3.4` (use corepack). Docker is
needed for the local PostgreSQL. `.nvmrc` pins Node 24 (the current LTS) and is the
single version source for CI (ADR-006 point 13).

```bash
pnpm install                  # also installs the Husky hooks (the prepare script)
cp .env.example .env          # then edit it; see the notes below
docker compose up -d          # PostgreSQL only (the default profile)
pnpm --filter @trading/database db:generate   # generate the Prisma client
pnpm --filter @trading/database db:migrate    # apply migrations (prisma migrate dev)
pnpm --filter @trading/database db:seed       # optional: baseline development data
pnpm --filter @trading/api dev                # run the API with auto-reload
```

Notes:

- `.env` is git-ignored. `JWT_SECRET` is required and must be at least 32
  characters; `PORT` defaults to `7001`. `DATABASE_URL` is read by Prisma but not
  validated by the API at startup (`docs/14-deployment-spec.md` §12), and it repeats
  the user, password, port and database of the Compose variables, so keep them in
  step.
- The seed never runs automatically (ADR-006 point 5). It wipes the database
  first, and the guard that makes it refuse to run when `NODE_ENV=production` is
  `Planned (B0)`, so never run it against a database you care about. `db:reset`
  is the hard reset (drops, re-migrates and reseeds, with a confirmation prompt).
  `README.md` describes both resets.
- Tests use a separate database. Create `trading_analytics_test` by hand on the same
  PostgreSQL instance, copy `.env.test.example` to `.env.test.local` (git-ignored),
  then run `pnpm --filter @trading/database db:test:migrate`.

Quality commands, run from the repository root (CI runs the same set, see
section 2):

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm docs:check
pnpm test
pnpm build
```

`pnpm lint:fix` and `pnpm format` apply fixes. `pnpm docs:check` verifies the
documentation structure (references, code fences, ADR sections), not its content.
The Husky `pre-commit` hook runs `lint-staged` (ESLint and Prettier on staged files).

---

## 10. Troubleshooting

| Symptom                                                                 | Likely cause and fix                                                                                                                                                                                                          |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The API exits at startup with `[api] invalid environment configuration` | A value in `.env` failed validation; the message names the keys, not the values. `JWT_SECRET` must be at least 32 characters.                                                                                                 |
| The API starts but `GET /health/ready` answers 503                      | PostgreSQL is not reachable or `DATABASE_URL` is missing or wrong. Run `docker compose up -d` and check `DATABASE_URL` against the Compose variables.                                                                         |
| `docker compose up -d` fails because port 5432 is taken                 | Set `DATABASE_PORT` (a Compose variable) to a free port and update `DATABASE_URL` to match.                                                                                                                                   |
| Tests fail to connect or find no schema                                 | `.env.test.local` is missing, or the test database was not created and migrated (see section 9).                                                                                                                              |
| Rate limiting blocks requests in development                            | Rate limits stay on in development; restarting the API clears the counters.                                                                                                                                                   |
| A commit is rejected by the `pre-commit` hook                           | `lint-staged` found an ESLint error it could not fix. Fix it, or run `pnpm lint` to see all findings.                                                                                                                         |
| `pnpm docs:check` fails                                                 | A reference to `NN-*.md` or `adr/NNNN-*.md` does not resolve, a code fence carries more than a language token, a `NN-*.md` has the wrong title line, or an ADR lacks a required section (`docs/README.md`, maintenance rule). |

Deployment and production-like troubleshooting are `Planned (B7)`.

---

## 11. Changing the Specification and Recording Decisions

The SDD documents are not immutable, but they are not silently diverged from either
(`docs/00-overview.md` §14; `docs/15-implementation-plan.md` §51):

- A change that diverges from a document updates that document **in the same pull
  request**.
- A new open decision is closed in a new ADR **before** the code depends on it: copy
  `docs/adr/template.md` to `docs/adr/NNNN-short-kebab-title.md`, fill every section,
  add a row to the index in `docs/adr/README.md`, and run `pnpm docs:check`.
- An accepted ADR is not rewritten silently. Edit the point and add an italic, dated
  correction note under it. A decision that is reversed is a new ADR that supersedes
  the old one.

The full rules are in `docs/adr/README.md` and `docs/README.md`.

---

## 12. Decided Workflow Questions

Questions about this workflow that were open and are now settled. The rules above
are the result.

1. **Decided 2026-10-08: merge commits, not squash.** Pull requests into `develop`
   are merged with a merge commit (section 4). It matches the 13 pull request merge
   commits already in the history and keeps the work-unit commits reviewable.
2. **Decided 2026-10-08: `style` is an accepted commit type** (section 6).
3. **Decided 2026-10-08: no commit message check now.** `.husky/` keeps only the
   `pre-commit` hook; no `commit-msg` hook or commitlint is added. This is revisited
   when the B0 CI exists.
