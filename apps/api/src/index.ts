import { randomUUID } from "node:crypto";
import { createChannelAuthorizer } from "@trading/application";
import { REALTIME_LIMITS } from "@trading/contracts";
import { prisma } from "@trading/database";
import { createApp } from "./app.js";
import { systemClock } from "./clock.js";
import { composition } from "./composition.js";
import { env } from "./config/env.js";
import { startServer } from "./lifecycle/bootstrap.js";
import { createJobsShutdownStep } from "./lifecycle/jobs-step.js";
import { createRealtimeShutdownStep } from "./lifecycle/realtime-step.js";
import { createShutdown } from "./lifecycle/shutdown.js";
import { logger } from "./logging/logger.js";
import { createAccessTokenAuthenticator } from "./realtime/access-token-authenticator.js";
import { createRealtimeGateway } from "./realtime/realtime-gateway.js";
import { realtimeHub } from "./realtime/realtime-runtime.js";
import { createSubscriptionHandler } from "./realtime/subscription-handler.js";
import { REALTIME_PATH, createWsTransport } from "./realtime/ws-transport.js";
import { accessTokens } from "./services/access-tokens.js";

const shutdown = createShutdown({ logger, exit: (code) => process.exit(code) });
const app = createApp({ isShuttingDown: shutdown.isShuttingDown });

// The runner stops first on shutdown, then the HTTP server closes (ADR-008 point 5).
shutdown.register(createJobsShutdownStep(composition.jobRunner));
composition.jobRunner.start();

const wsTransport = createWsTransport({
  path: REALTIME_PATH,
  maxPayloadBytes: REALTIME_LIMITS.maxInboundPayloadBytes,
});
const subscriptions = createSubscriptionHandler({
  hub: realtimeHub,
  authorizer: createChannelAuthorizer({
    portfolioService: composition.portfolioService,
    jobRepository: composition.jobRepository,
  }),
  logger,
});
const realtimeGateway = createRealtimeGateway({
  transport: wsTransport,
  authenticate: createAccessTokenAuthenticator(accessTokens),
  clock: systemClock,
  logger,
  newId: randomUUID,
  handleMessage: subscriptions.handleMessage,
  onReauthenticated: subscriptions.handleReauthenticated,
  onConnectionClosed: subscriptions.handleConnectionClosed,
});
// Connections close with 1001 before the HTTP server drains (ADR-007 point 16).
shutdown.register(createRealtimeShutdownStep(realtimeGateway));
realtimeGateway.start();

const server = startServer({
  app,
  port: env.PORT,
  logger,
  shutdown,
  disconnect: () => prisma.$disconnect(),
  signals: process,
});
wsTransport.attach(server);
