import type { LogFields, Logger } from "./logger.js";

/** Stable name of the entry written when an event could not be published. */
export const REALTIME_PUBLISH_FAILED_EVENT = "realtime.publish_failed";

/**
 * Publishes one realtime event after a change committed, and never lets the
 * publish fail the caller (ADR-007 points 12 and 17).
 *
 * Realtime is best effort and degrades to HTTP: a publisher that rejects, or
 * throws before it returns a promise, is logged as a warning with the event
 * name and the fields that locate it, and the caller carries on as if the
 * event had been delivered.
 */
export async function publishQuietly(
  logger: Logger,
  event: string,
  fields: LogFields,
  publish: () => Promise<void>,
): Promise<void> {
  try {
    await publish();
  } catch (error) {
    logger.warn(REALTIME_PUBLISH_FAILED_EVENT, {
      event,
      ...fields,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
