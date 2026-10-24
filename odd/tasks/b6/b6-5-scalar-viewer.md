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

- [x] T1 `API_DOCS_ENABLED` (and `API_DOCS_CDN_URL`) in the environment schema with the default of S2; dependency b41f42a, env 49f1a71.
- [x] T2 The two routes behind that flag, with tests for on and off (0a087b5, 2e17c36); the production default is tested on the environment schema.
- [ ] T3 The relaxed policy for the viewer page only is done (0a087b5) and tested; the manual check in a browser is pending: it needs a person with a browser and the running API.

## Done when

With the flag on, the viewer shows every endpoint and can call one with a pasted token; with the flag off or in production by default, both routes are 404.

## Risk

Item 2 (security: a route that exposes the whole API surface and relaxes a CSP) and item 5 (a new dependency). The default-off in production and the 404 test are the guard.

## Verification

pnpm --filter @trading/api test (files that need no database), pnpm typecheck, pnpm lint, pnpm build.

## Log

L1 Request: "PR merged y develop actualizada, haz B6-5" (the plan was approved with the decisions taken from the recommendations)
L2 Decisions taken with the recommendation:

- D1 `@scalar/express-api-reference@0.10.31` (MIT) is pinned in `apps/api`. It renders a page that loads the viewer script from a CDN; nothing is sent to a hosted Scalar service.
- D2 `API_DOCS_ENABLED` is `true` or `false`; unset is on outside production and off in production (S2). `API_DOCS_CDN_URL` is the config option of S4: an http(s) URL, default Scalar's jsDelivr bundle. The trade-off is in `docs/04-tech-stack.md` §42: the viewer needs the network to load its script, and a team that works offline serves the bundle itself and sets this variable.
- D3 `createApp({ docsEnabled })` overrides the flag for tests. The docs router is mounted after the general rate limiter and the JSON parser, so the limits are those of the rest; when off, the router is not mounted and both paths fall through to the normal 404 envelope.
- D4 The viewer page sets its own `Content-Security-Policy` header, replacing the `helmet()` one for that response only: `script-src` is the per-request nonce plus the CDN origin (no `unsafe-eval`, no inline script without the nonce), `style-src` adds `'unsafe-inline'` because the viewer renders inline styles, `connect-src` is `'self'` plus the CDN origin, `frame-ancestors 'none'`. With a nonce the library loads the single-file bundle, whose script needs no follow-up requests. `withDefaultFonts: false` stops the viewer from loading fonts from a third party.
- D5 The document is built once, when the router is created, from `API_OPERATIONS`. Its description says how to use the bearer token and points to `docs/08-realtime-spec.md` for the WebSocket (B6.3 D6). The token is declared as the `bearerAuth` scheme and the user pastes it in the viewer; no credential is in the page or the config (S3).
- D6 The drift test builds the app with `docsEnabled: false`, because the docs routes are not API routes (S5).
- D7 `.env.example` was not changed: reading it is blocked in this session. The two lines to add are `# API_DOCS_ENABLED=true` and `# API_DOCS_CDN_URL=`, both commented. `docs/04-tech-stack.md` §42 lists both variables (S6); B6.6 does the rest of the docs.
- Checks: 9 tests in `docs.routes.test.ts` and 37 in `env.test.ts` pass with the example test env; `tsc` and ESLint clean on `apps/api`. The first run of `docs.routes.test.ts` timed out once in its first test (5 s) while another test file compiled at the same time and did not repeat in three more runs. `pnpm build` was not run.
- Not checked: the viewer in a real browser (T3). The tests prove the policy and the nonce on the page, not that the browser accepts every request the viewer makes.
- Risk: item 2 (a route that exposes the API surface and a relaxed CSP on one page, guarded by default-off in production and the 404 tests) and item 5 (new dependency).
