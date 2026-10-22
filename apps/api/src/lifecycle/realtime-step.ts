import type { RealtimeGateway } from "../realtime/realtime-gateway.js";
import type { ShutdownStep } from "./shutdown.js";

/**
 * The shutdown step of the realtime server (ADR-006 point 12, ADR-007 point 16).
 *
 * Register it before the HTTP step: an upgraded socket keeps the HTTP server
 * from closing, so every connection gets close code `1001` first.
 */
export function createRealtimeShutdownStep(gateway: Pick<RealtimeGateway, "stop">): ShutdownStep {
  return { name: "realtime", run: () => gateway.stop() };
}
