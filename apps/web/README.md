# @trading/web

The web app of the Trading Analytics Platform: React 19, TypeScript, Vite, Tailwind and
TanStack Query. It builds in two modes from the same code:

- **Real**: talks to the API over HTTP and WebSocket.
- **Demo**: a static build with no API and no database. The browser runs the real application
  services over in-memory repositories and a simulated market (see
  [ADR-012](../../docs/adr/0012-demo-build-specifics.md)).

## Run it

From the repository root:

```bash
pnpm --filter @trading/web dev         # real mode, http://localhost:5173 (needs the API)
pnpm --filter @trading/web dev:demo    # demo mode, no API needed
pnpm --filter @trading/web build       # real build in dist/
pnpm --filter @trading/web build:demo  # demo build in dist/
```

## Scripts

| Script                | What it does                                                             |
| --------------------- | ------------------------------------------------------------------------ |
| `dev`, `dev:demo`     | Vite dev server in real or demo mode                                     |
| `build`, `build:demo` | Type-checks and builds                                                   |
| `preview`             | Serves a build locally                                                   |
| `typecheck`           | `tsc --build`                                                            |
| `test`                | Vitest unit and component tests (jsdom, with axe checks)                 |
| `test:e2e`            | Playwright against the real build, with the API and WebSocket mocked     |
| `test:e2e:demo`       | Builds the demo and runs a Playwright smoke against it                   |
| `check:bundles`       | Checks the demo bundle has no HTTP adapter and the real one no demo code |

## Configuration

Validated in `src/config/env.ts`. All variables are optional and have local defaults.

| Variable            | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `VITE_APP_MODE`     | `real` (default) or `demo`; the demo scripts set it  |
| `VITE_API_BASE_URL` | API address (default `http://localhost:7001`)        |
| `VITE_WS_URL`       | WebSocket address (default `ws://localhost:7001/ws`) |

## Structure

```text
src/
  pages/        # One folder per route (dashboard, portfolios, transactions, analytics, ...)
  features/     # By domain: components, hooks and lib of each feature
  components/   # Shared UI: ui/ (base components) and shell/ (layout, navigation)
  hooks/        # Hooks shared across features
  stores/       # Client state (session, active portfolio, language, motion)
  services/     # Composition of the application services for the app
  api/          # Typed HTTP client and its operations
  realtime/     # WebSocket client, reconnection and live data
  demo/         # Demo build only: handlers, seed and the simulated market wiring
  runtime/      # Chooses the real or the demo runtime at build time
  styles/       # Design tokens (tokens.css) and base styles
  i18n/         # Translations
e2e/            # Playwright specs for the real build
e2e-demo/       # Playwright smoke for the demo build
```

Colors, spacing and typography come from the tokens in `src/styles/tokens.css`; components use
them instead of raw values. Each view ships with its phone and tablet layouts.

## More

The user interface specification is `docs/11-ui-ux-spec.md` and the demo mode specification is
`docs/12-demo-mode-spec.md`; decisions are in [`docs/adr/`](../../docs/adr/README.md). The demo is
published with the root [`netlify.toml`](../../netlify.toml).
