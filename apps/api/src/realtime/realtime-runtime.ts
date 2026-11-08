import { randomUUID } from "node:crypto";
import { systemClock } from "../clock.js";
import { createHubRealtimePublisher } from "./hub-realtime-publisher.js";
import { createRealtimeHub } from "./realtime-hub.js";

/**
 * The hub and publisher of this process (ADR-007 points 5 and 17).
 *
 * They are built here, before the composition, because the services need the
 * publisher when they are created and the WebSocket gateway needs the hub to
 * subscribe sockets to it. `sequence` restarts with the process, so the epoch
 * is a fresh id per run and tells a client when to reset its baseline.
 */
export const realtimeHub = createRealtimeHub({
  clock: systemClock,
  newId: randomUUID,
  epoch: randomUUID(),
});

export const realtimePublisher = createHubRealtimePublisher(realtimeHub);
