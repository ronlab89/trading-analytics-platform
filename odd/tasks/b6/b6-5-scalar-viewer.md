# B6.5 Serve the document and the Scalar viewer

Source: roadmap B6; `04-tech-stack.md` §21 (open detail: whether and how the document is served). Depends on: B6.4. Branch: `feat/b6-5-scalar-viewer`. Test runner: Vitest.

Working rules: as B6.1.

Provisional: re-verified when the slice starts.

## Allowed edit surfaces

apps/api/src/**
apps/api/package.json
pnpm-lock.yaml
.env.example
odd/tasks/b6/**

## Specs

- S1 `GET /openapi.json` serves the generated document and `GET /api/docs` serves the Scalar viewer pointed at it (`@scalar/express-api-reference`, MIT, no hosted service involved).
- S2 They are on when `API_DOCS_ENABLED` is `true`. When it is not set, it defaults to on outside `NODE_ENV=production` and off in production. When off, both routes answer the normal 404 envelope.
- S3 The bearer token is declared as the security scheme, so the viewer can send authenticated requests with a token the user pastes in; no credential is stored in the page or the config.
- S4 The viewer's script comes from the Scalar CDN by default; the config option and its offline trade-off are written down. The page is the only route that needs a relaxed Content-Security-Policy, and only while the docs are on.
- S5 The routes are not rate-limited differently from the rest and are not part of the drift test routes (they are documented as non-API routes).
- S6 `.env.example` and the configuration docs list `API_DOCS_ENABLED`.

## Tasks

- [ ] T1 `API_DOCS_ENABLED` in the environment schema with the default of S2.
- [ ] T2 The two routes behind that flag, with tests for on, off and production default.
- [ ] T3 The relaxed policy for the viewer page only (check what `helmet()` blocks first) and a manual check in a browser.

## Done when

With the flag on, the viewer shows every endpoint and can call one with a pasted token; with the flag off or in production by default, both routes are 404.

## Risk

Item 2 (security: a route that exposes the whole API surface and relaxes a CSP) and item 5 (a new dependency). The default-off in production and the 404 test are the guard.

## Verification

pnpm --filter @trading/api test (files that need no database), pnpm typecheck, pnpm lint, pnpm build.

## Log
