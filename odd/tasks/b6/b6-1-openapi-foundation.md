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

- [x] T1 `ApiOperation` type (`api-operation.ts`), with the error statuses 400, 401, 403, 404, 409, 413, 429 and 500. Commit 026d354.
- [x] T2 `buildOpenApiDocument` (`openapi.ts`) over `toJSONSchema` with the `draft-2020-12` target (Zod 4.6.5 also offers `openapi-3.0`, which would give 3.0.x). The bearer scheme and the `ErrorResponse` component are in the builder. Tested with sample operations for an item, a list with `meta`, a 204, a public operation with a body, and duplicates. Commit 026d354.
- [x] T3 `validate()` returns the middleware with a `validation` property, and `validationOf(handler)` reads it. Commit in the same branch, `feat(api): expose the schema and source a validate() middleware checks`.

## Done when

The document of the sample operations validates as OpenAPI, and `validate()` exposes what it validates.

## Risk

None expected (new code in contracts; `validate()` only gains properties). Re-check item 3 for `validate()`, which every route uses.

## Verification

pnpm --filter @trading/contracts test, pnpm --filter @trading/api test (files that need no database), pnpm typecheck, pnpm lint.

## Log

L1 Request: "Si lo apruebo, haz B6-1 completo tu mismo con los commits, las decisiones quedan aprobadas con tus recomendaciones y paras al terminar para hacer el PR, actualizar pr-body y me dejas los comandos necesarios"
L2 Decisions taken with the recommendation:

- D1 The document is OpenAPI 3.1.0 with JSON Schema `draft-2020-12`: the dialect 3.1 uses, so a nullable field is `type: ["number", "null"]`. The `$schema` key is stripped from every embedded schema.
- D2 Requests use `io: "input"` (a field with a default is optional) and responses use `io: "output"`. `unrepresentable: "any"` so a schema Zod cannot express never throws while generating.
- D3 An operation with no `security` entry is not allowed: private ones get `[{ bearerAuth: [] }]` and public ones get `[]`.
- D4 The builder refuses a repeated `operationId` or method and path, so B6.2 and B6.3 cannot register an endpoint twice.
- D5 The sample operations live in the test, not in the registry; the real registry starts in B6.2.
- D6 `validate()` keeps its behavior; it only gains the `validation` property. The notifications list has no pagination query (only `unreadOnly`), which B6.2 and B6.3 must reflect when they describe it.
- Checks: contracts 228 tests pass, `tsc` and ESLint are clean on `packages/contracts` and `apps/api/src/middleware`; `validate.test.ts` passes with the `.env.test.example` values; `params.routes.test.ts` needs the database and was not run.
- Risk: none (new code in contracts; `validate()` only gains a property, and every route uses it, which the unit and route-level tests cover).
