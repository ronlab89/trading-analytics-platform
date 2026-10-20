import { prisma } from "@trading/database";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startServer } from "./lifecycle/bootstrap.js";
import { createShutdown } from "./lifecycle/shutdown.js";
import { logger } from "./logging/logger.js";

const shutdown = createShutdown({ logger, exit: (code) => process.exit(code) });
const app = createApp({ isShuttingDown: shutdown.isShuttingDown });

startServer({
  app,
  port: env.PORT,
  logger,
  shutdown,
  disconnect: () => prisma.$disconnect(),
  signals: process,
});
