# B6.1 OpenAPI generator foundation

Source: roadmap B6; ADR-002 point 7; `07-api-spec.md` §57; `04-tech-stack.md` §21. Depends on: B5. Branch: `feat/b6-1-openapi-foundation`. Test runner: Vitest (`pnpm --filter <package> test`).

Working rules: tiny tasks, each approved by the user before any edit (or delegated for the whole slice); no subagents; the user runs tests, lint and commits unless asked.

Provisional: re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/contracts/src/**
apps/api/src/middleware/validate.ts
apps/api/src/middleware/validate.test.ts
odd/tasks/b6/**

## Specs

- S1 An `ApiOperation` description lives in `@trading/contracts` as plain data: method, path, summary, tag, whether it needs authentication, the `params`, `query` and `body` schemas, the success status with its response schema, and the error statuses it can return. Contracts stay free of Express.
- S2 `buildOpenApiDocument(operations)` returns an OpenAPI document generated with Zod v4's `toJSONSchema`; nothing in it is written by hand except the title, version, servers and the security scheme (bearer access token).
- S3 The shared error envelope (`error.schema.ts`) is a component referenced by every error response; success responses use the `{ data }` and `{ data, meta }` envelopes already in `response-common.schema.ts`.
- S4 `validate(schema, source)` tags the middleware it returns with its schema and source, so the drift test of B6.4 can read them from the router.
- S5 One real operation per envelope shape (a single item, a list with `meta`, a 204 with no body) is described and tested, to prove the shape before B6.2 and B6.3 fill the rest.

## Tasks

- [ ] T1 `ApiOperation` type, the error component and the bearer security scheme.
- [ ] T2 `buildOpenApiDocument` over `toJSONSchema` (check the target for OpenAPI 3.1 against the installed Zod), with the three sample operations.
- [ ] T3 Tag `validate()` with its schema and source.

## Done when

The document of the sample operations validates as OpenAPI, and `validate()` exposes what it validates.

## Risk

None expected (new code in contracts; `validate()` only gains properties). Re-check item 3 for `validate()`, which every route uses.

## Verification

pnpm --filter @trading/contracts test, pnpm --filter @trading/api test (files that need no database), pnpm typecheck, pnpm lint.

## Log
