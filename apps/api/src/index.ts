import { prisma } from "@trading/database";
import { createApp } from "./app.js";
import { composition } from "./composition.js";
import { env } from "./config/env.js";
import { startServer } from "./lifecycle/bootstrap.js";
import { createJobsShutdownStep } from "./lifecycle/jobs-step.js";
import { createShutdown } from "./lifecycle/shutdown.js";
import { logger } from "./logging/logger.js";

const shutdown = createShutdown({ logger, exit: (code) => process.exit(code) });
const app = createApp({ isShuttingDown: shutdown.isShuttingDown });

// The runner stops first on shutdown, then the HTTP server closes (ADR-008 point 5).
shutdown.register(createJobsShutdownStep(composition.jobRunner));
composition.jobRunner.start();

startServer({
  app,
  port: env.PORT,
  logger,
  shutdown,
  disconnect: () => prisma.$disconnect(),
  signals: process,
});
