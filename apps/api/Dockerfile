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
