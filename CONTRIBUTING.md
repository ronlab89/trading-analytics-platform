# Contributing Guide

This document defines how work is organized, branched, committed, and merged in this repository.

This project is developed by a single engineer as a portfolio piece, but follows a
professional workflow intentionally — as evidence of engineering discipline, not
as ceremony for its own sake. Every rule below exists for a concrete reason, in
line with the project's own principle (see `docs/03-non-functional-requirements.md`,
NFR-070): avoid complexity — including process complexity — that isn't justified.

---

## 1. Branching Model

This repository uses a simplified GitHub Flow with a staging layer:

```text
main        → always deployable, protected, clean history (merge commit from develop)
develop     → integration branch, base for staging/demo preview
feat/*      → new functionality, merged into develop via PR (squash merge)
fix/*       → bug fixes, merged into develop via PR (squash merge)
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
- Separate `staging`/`production` branches — `develop` already serves the staging role;
  `main` serves the production role.

If the project's needs change (e.g. a team joins, or coordinated releases become
necessary), this document should be updated explicitly rather than silently
diverging from it — consistent with how the SDD documents themselves are
maintained (see `docs/00-overview.md`, §14).

---

## 2. Branch Protection Rules

| Branch | Protected | Merge allowed from | Requires CI green |
|---|---|---|---|
| `main` | Yes | `develop` only (PR) | Yes |
| `develop` | Yes (minimum) | `feat/*`, `fix/*`, `docs/*`, `chore/*` (PR) | Yes |
| `feat/*`, `fix/*`, `docs/*`, `chore/*` | No | — | — |

CI (once implemented per `docs/04-tech-stack.md` §41) must pass — install, typecheck,
lint, tests, build — before a PR can be merged into `develop` or `main`.

---

## 3. When Does `develop` Go to `main`?

Not after every feature. `develop → main` happens when a **milestone** from
`docs/15-implementation-plan.md` (§52–59) is closed — so that `main` always
reflects a coherent, demonstrable state of the project rather than incremental noise.

---

## 4. Merge Strategy

- **`feat/*`, `fix/*`, `docs/*`, `chore/*` → `develop`**: **Squash merge**.
  Each feature/fix becomes one atomic, well-described commit on `develop`.
- **`develop` → `main`**: **Merge commit** (no squash).
  This preserves the fact that this point represents an actual milestone/release,
  not just another commit.

---

## 5. Pull Requests

Pull requests are used even though there is a single contributor, for two concrete reasons:

1. **Clean commit history** — squash merge means `develop`/`main` never accumulate
   "wip", "fix typo", "oops" commits.
2. **Real CI gate** — a PR cannot merge if the pipeline fails, which is enforced
   evidence of engineering discipline, not just a claim in a README.

Every PR description should briefly state:

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
```

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
working agreement / `PROGRESS.md`). The typical flow for a step is:

```text
1. Open a branch from develop (feat/*, fix/*, docs/*, chore/*)
2. Implement the approved step
3. Verify against the step's acceptance criteria
4. Commit(s) following the convention above
5. Push and open a PR into develop
6. CI runs (once configured)
7. Merge (squash) into develop
8. Delete the feature branch
```

At milestone boundaries, a PR from `develop` into `main` is opened and merged
(merge commit), and `PROGRESS.md` is updated accordingly.

---

## 8. Relationship to Project Documentation

- **`docs/00-*.md` through `docs/15-*.md`** define *what* is being built (product,
  architecture, requirements).
- **This file** defines *how* the work is organized and delivered.
- **`PROGRESS.md`** (repository root) tracks *current state* between work sessions —
  phase, step, what's done, what's next. It links back here rather than repeating
  workflow rules.