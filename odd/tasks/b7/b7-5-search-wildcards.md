# B7.5 Wildcard escaping in the assets search

Source: roadmap B7 ("Known debts") and §4; ADR-010 point 2; `02-functional-requirements.md` search line. Depends on: none (independent of B7.1 to B7.4). Branch: `fix/b7-5-search-wildcards`.

Working rules: as B7.1.

## Allowed edit surfaces

packages/database/src/repositories/prisma-asset-repository.ts
packages/database/src/repositories/prisma-asset-repository.test.ts
packages/persistence-memory/src/**
packages/persistence-memory/src/contract/**
docs/**
odd/tasks/b7/**

## Specs

- S1 A search term containing `%`, `_` or `\` matches those characters literally in the assets `search` filter (`PROGRESS.md` §7: only assets has a `contains` filter; transactions have no free-text search).
- S2 The memory and the Prisma repositories answer the same way, pinned by the shared contract suite.
- S3 A term without those characters behaves as before.

## Tasks

- [x] T1 RED: contract case, then a Prisma case, where searching `%` or `_` returns only assets whose name or symbol contains that literal character.
- [x] T2 Escape the term before it reaches `contains`, in one helper next to the repository. T1 of this task confirms how the current filter builds its query and whether Prisma passes the backslash escape through to PostgreSQL `ILIKE`.
- [x] T3 Docs: the `Planned (B7)` mark in `02` and the roadmap item.

## Done when

Searching `%` no longer returns every asset, in both repositories.

## Risk

Item 3 only if the filter is shared with another caller; T2 checks that with a search for other users of the helper. Otherwise none.

## Verification

pnpm --filter @trading/database test (needs the test database); pnpm --filter @trading/persistence-memory test; pnpm lint; pnpm typecheck; pnpm docs:check.

## Log

L1 Request: as B7.1 (the task files for B7).
L2 Done 2026-10-25. RED observed: the new contract case failed 3 of 12 on the Prisma adapter (one per character) and passed on the in-memory one, which uses `includes`. Prisma does not escape the `contains` term, so `escapeLikeTerm` (in `prisma-asset-repository.ts`) prefixes `\`, `%` and `_` with a backslash, PostgreSQL's default `LIKE` escape. After it: Prisma 12 of 12, `persistence-memory` 314, `database` 206, typecheck and lint pass. Only the asset repository uses `contains` (`prisma-portfolio-repository.ts` only mentions the word in a comment), so no other caller changes. The test and the fix share one commit.
