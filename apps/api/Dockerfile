# Production image of the API. Build with the workspace root as the context (ADR-006 point 4):
#   docker build -f apps/api/Dockerfile -t trading-api .

ARG NODE_VERSION=24

# --- build: install every dependency, generate the Prisma client, compile all packages ---
FROM node:${NODE_VERSION}-slim AS build

# Prisma needs OpenSSL to detect the platform and to pick the matching engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# The husky `prepare` script has no .git directory to hook into here.
ENV HUSKY=0
RUN corepack enable

WORKDIR /repo

# Manifests first, so the install layer is reused until a dependency changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/application/package.json packages/application/
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
COPY packages/market-sim/package.json packages/market-sim/
COPY packages/persistence-memory/package.json packages/persistence-memory/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json tsconfig.json ./
COPY apps/api apps/api
COPY packages packages

RUN pnpm --filter @trading/database exec prisma generate
RUN pnpm build
# tsc also emits the compiled tests; the runtime image carries none (and nothing imports them).
RUN find apps/*/dist packages/*/dist -name '*.test.*' -type f -delete

# --- deps: production dependencies only, installed from the same lockfile ---
FROM node:${NODE_VERSION}-slim AS deps

ENV HUSKY=0
RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/application/package.json packages/application/
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
COPY packages/domain/package.json packages/domain/
COPY packages/market-sim/package.json packages/market-sim/
COPY packages/persistence-memory/package.json packages/persistence-memory/
# `pnpm deploy` is not used: it follows each package's `files`, which leaves out the generated
# Prisma client that `@trading/database` loads from next to its `dist`. Scripts are skipped: the
# root `prepare` runs husky, a dev dependency, and the client is generated in the build stage.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# --- runtime: no package manager invoked, no dev dependencies, no sources ---
FROM node:${NODE_VERSION}-slim AS runtime

# The Prisma engine links against OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  TZ=UTC

WORKDIR /repo

COPY --from=deps --chown=node:node /repo ./
COPY --from=build --chown=node:node /repo/apps/api/dist apps/api/dist
COPY --from=build --chown=node:node /repo/packages/application/dist packages/application/dist
COPY --from=build --chown=node:node /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build --chown=node:node /repo/packages/database/dist packages/database/dist
COPY --from=build --chown=node:node /repo/packages/database/generated packages/database/generated
COPY --from=build --chown=node:node /repo/packages/domain/dist packages/domain/dist
COPY --from=build --chown=node:node /repo/packages/market-sim/dist packages/market-sim/dist

USER node
WORKDIR /repo/apps/api

EXPOSE 7001

# `node` is the only tool in the image, so the probe is a one-line fetch of the readiness route.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||7001)+'/health/ready',{signal:AbortSignal.timeout(3000)}).then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]

# Exec form with no shell or package-manager wrapper, so SIGTERM reaches the process and runs the
# graceful shutdown (ADR-006 point 12).
ENTRYPOINT ["node", "dist/index.js"]
