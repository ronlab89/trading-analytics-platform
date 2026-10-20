import type { Logger } from "@trading/application";
import { LOG_EVENTS } from "../logging/events.js";

/** One thing to close during shutdown: the HTTP server, the database, later jobs and realtime. */
export interface ShutdownStep {
  name: string;
  run(): Promise<void>;
}

export interface ShutdownOptions {
  logger: Logger;
  /** Ends the process; injected so tests never exit for real. */
  exit: (code: number) => void;
}

export interface Shutdown {
  /** Adds a step after the ones already registered; steps run in registration order. */
  register(step: ShutdownStep): void;
  /** True from the first instant of `trigger`, so readiness can answer 503 at once. */
  isShuttingDown(): boolean;
  /** Runs the sequence once; a later call returns the same promise. */
  trigger(signal: string): Promise<void>;
}

/**
 * The ordered close sequence of the process (ADR-006 point 12, ADR-009 point 11).
 *
 * Steps run one after another in registration order. B4 (job runner) and B5
 * (realtime connections, close code `1001`) register theirs before the HTTP
 * step, so they stop first. A failed step does not stop the rest: the others
 * still close, and the exit code becomes 1.
 */
export function createShutdown({ logger, exit }: ShutdownOptions): Shutdown {
  const steps: ShutdownStep[] = [];
  let running: Promise<void> | undefined;
  // Set before `run` starts: its first step executes synchronously, before `running` is assigned.
  let started = false;

  async function run(signal: string): Promise<void> {
    logger.info(LOG_EVENTS.appShutdownStarted, { signal });

    const failedSteps: string[] = [];
    for (const step of steps) {
      try {
        await step.run();
      } catch (error) {
        failedSteps.push(step.name);
        logger.error(LOG_EVENTS.appShutdownStepFailed, {
          step: step.name,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }

    const exitCode = failedSteps.length === 0 ? 0 : 1;
    logger.info(LOG_EVENTS.appShutdownCompleted, {
      exitCode,
      ...(failedSteps.length > 0 ? { failedSteps } : {}),
    });
    exit(exitCode);
  }

  return {
    register(step) {
      steps.push(step);
    },
    isShuttingDown: () => started,
    trigger(signal) {
      if (running === undefined) {
        started = true;
        running = run(signal);
      }
      return running;
    },
  };
}
