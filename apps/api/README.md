# @trading/api

The REST and realtime API of the Trading Analytics Platform: Express 5, TypeScript, Prisma and
PostgreSQL. It exposes the application layer (`@trading/application`) over HTTP and WebSocket.

## Run it

From the repository root (PostgreSQL, migrations and the optional seed are described in the
[root README](../../README.md#run-the-api)):

```bash
pnpm --filter @trading/api dev      # watch mode, PORT defaults to 7001
pnpm --filter @trading/api build    # compile to dist/
pnpm --filter @trading/api start    # run the compiled build
```

Check that it is up with `GET /health` (liveness) and `GET /health/ready` (readiness, 503 when
PostgreSQL is not reachable). The API reference is served at `/api/docs` and the OpenAPI document
at `/openapi.json`; both are off in production unless `API_DOCS_ENABLED=true`.

## Scripts

| Script       | What it does                                           |
| ------------ | ------------------------------------------------------ |
| `dev`        | Runs the API from source with the repository `.env`    |
| `build`      | `tsc --build`                                          |
| `start`      | Runs `dist/index.js` with the repository `.env`        |
| `typecheck`  | `tsc --noEmit`                                         |
| `test`       | Vitest, using `.env.test.local` at the repository root |
| `test:watch` | Vitest in watch mode                                   |

## Configuration

Read and validated at start-up in `src/config/env.ts`; a wrong value stops the process with a
message. Copy `.env.example` at the repository root to `.env`.

| Variable                                           | Purpose                                      |
| -------------------------------------------------- | -------------------------------------------- |
| `DATABASE_URL`                                     | PostgreSQL connection string                 |
| `JWT_SECRET`                                       | Signs access tokens; at least 32 characters  |
| `JWT_EXPIRES_IN_SECONDS`                           | Access token lifetime                        |
| `SESSION_IDLE_SECONDS`, `SESSION_ABSOLUTE_SECONDS` | Refresh session idle and absolute limits     |
| `CORS_ORIGIN`                                      | Allowed browser origin(s)                    |
| `PORT`                                             | Listening port (default 7001)                |
| `LOG_LEVEL`, `SLOW_REQUEST_THRESHOLD_MS`           | Structured logging                           |
| `API_DOCS_ENABLED`, `API_DOCS_CDN_URL`             | Serves the API reference outside development |

## Structure

```text
src/
  routes/        # One router per resource, with its route tests beside it
  controllers/   # HTTP in and out: parse, call the service, present
  services/      # Authentication: sessions, access and refresh tokens, logout, health
  middleware/    # Authenticate, validate, idempotency, rate limit, request id, errors
  realtime/      # WebSocket hub, authentication and the HTTP fallback
  import/        # CSV tokenizer for the import jobs
  simulation/    # Price simulation that feeds alerts and realtime
  lifecycle/     # Start-up and graceful shutdown (jobs, realtime and simulator steps)
  config/        # Environment parsing
  logging/       # Logger and request logging
  composition.ts # Wires the application layer to the Prisma repositories
  app.ts         # Builds the Express app
  index.ts       # Process entry point
```

Business rules live in `@trading/domain` and `@trading/application`, not here; the shared request
and response contracts, which also generate the OpenAPI document, are in `@trading/contracts`.

## More

Decisions and specifications are in [`docs/`](../../docs/README.md), starting with the API
specification (`docs/07-api-spec.md`) and the deployment specification
(`docs/14-deployment-spec.md`). The container image is built with `apps/api/Dockerfile`.
