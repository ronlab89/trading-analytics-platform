# Image of the web app (real mode: it talks to the API). Build with the workspace root as the
# context, like the API image:
#   docker build -f apps/web/Dockerfile -t trading-web .
#
# The API addresses are fixed at build time (Vite replaces them in the bundle), and they are the
# ones the browser uses, so they point at the published port of the API, not at the Compose name.

ARG NODE_VERSION=24

# --- build: install the web app and the packages it uses, then build the static files ---
FROM node:${NODE_VERSION}-slim AS build

ENV HUSKY=0
RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/application/package.json packages/application/
COPY packages/contracts/package.json packages/contracts/
COPY packages/domain/package.json packages/domain/
COPY packages/market-sim/package.json packages/market-sim/
COPY packages/persistence-memory/package.json packages/persistence-memory/
RUN pnpm install --frozen-lockfile

ARG VITE_API_BASE_URL=http://localhost:7001
ARG VITE_WS_URL=ws://localhost:7001/ws
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
  VITE_WS_URL=${VITE_WS_URL}

COPY tsconfig.base.json tsconfig.json ./
COPY apps/web apps/web
# The root tsconfig also references the API project, and Vite resolves that file.
COPY apps/api/tsconfig.json apps/api/
# The root tsconfig references every package, so the whole folder is copied (after the install,
# so the install layer is still reused).
COPY packages packages

RUN pnpm --filter @trading/web build

# --- runtime: static files behind Nginx, as a non-root user, with the single-page fallback ---
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD ["wget", "-qO-", "http://127.0.0.1:8080/"]
