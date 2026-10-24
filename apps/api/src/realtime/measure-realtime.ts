import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { performance } from "node:perf_hooks";
import WebSocket from "ws";
import { capturingLogger } from "@trading/application";
import { REALTIME_LIMITS } from "@trading/contracts";
import { Money, UserRole } from "@trading/domain";
import { systemClock } from "../clock.js";
import { createTokenService } from "../services/token.service.js";
import { createAccessTokenAuthenticator } from "./access-token-authenticator.js";
import { createHubRealtimePublisher } from "./hub-realtime-publisher.js";
import { createRealtimeGateway } from "./realtime-gateway.js";
import { createRealtimeHub } from "./realtime-hub.js";
import { createSubscriptionHandler } from "./subscription-handler.js";
import { REALTIME_PATH, createWsTransport } from "./ws-transport.js";

/**
 * Server-side realtime measurement (spec 08 §32, roadmap B5).
 *
 *   pnpm --filter @trading/api exec tsx src/realtime/measure-realtime.ts [connections] [ticks] [intervalMs]
 *
 * One process holds the server and every client, over real loopback sockets,
 * so a tick's latency is the time from `marketPriceUpdated` to the message
 * arriving at a client, taken on one monotonic clock. It measures the hub,
 * the gateway and `ws`, not the network or the browser.
 */

const CONNECTIONS = Number(process.argv[2] ?? 200);
const TICKS = Number(process.argv[3] ?? 500);
const INTERVAL_MS = Number(process.argv[4] ?? 0);
const ASSET = "a1";

const tokens = createTokenService({
  secret: "measurement-secret-measurement-secret-0000",
  ttlSeconds: 3600,
  clock: systemClock,
});

const usd = (amount: string) => Money.of(amount, "USD");

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

const transport = createWsTransport({
  path: REALTIME_PATH,
  maxPayloadBytes: REALTIME_LIMITS.maxInboundPayloadBytes,
  closeGraceMs: 500,
});
const logger = capturingLogger();
const hub = createRealtimeHub({
  clock: systemClock,
  newId: () => crypto.randomUUID(),
  epoch: "m1",
});
const handler = createSubscriptionHandler({
  hub,
  authorizer: { canSubscribe: () => Promise.resolve(true) },
  logger,
});
const gateway = createRealtimeGateway({
  transport,
  authenticate: createAccessTokenAuthenticator(tokens),
  clock: systemClock,
  logger,
  newId: () => crypto.randomUUID(),
  handleMessage: handler.handleMessage,
  onReauthenticated: handler.handleReauthenticated,
  onConnectionClosed: handler.handleConnectionClosed,
});
gateway.start();
const server = createServer();
transport.attach(server);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `ws://127.0.0.1:${(server.address() as AddressInfo).port.toString()}${REALTIME_PATH}`;

const sentAt = new Map<number, number>();
const latencies: number[] = [];
const sockets: WebSocket[] = [];

// One user per connection: the per-user limit is 5.
function connectOne(index: number): Promise<void> {
  {
    const socket = new WebSocket(url);
    sockets.push(socket);
    return new Promise<void>((resolve, reject) => {
      let acks = 0;
      socket.on("error", reject);
      socket.on("open", () => {
        socket.send(
          JSON.stringify({
            type: "AUTHENTICATE",
            accessToken: tokens.issue({ userId: `u${index.toString()}`, role: UserRole.TRADER })
              .accessToken,
          }),
        );
      });
      socket.on("message", (data) => {
        const received = performance.now();
        const message = JSON.parse((data as Buffer).toString("utf8")) as {
          type: string;
          sequence?: number;
        };
        if (message.type === "ACK") {
          acks += 1;
          if (acks === 1) {
            socket.send(JSON.stringify({ type: "SUBSCRIBE", channel: `market:${ASSET}` }));
          } else {
            resolve();
          }
        } else if (message.type === "MARKET_PRICE_UPDATED" && message.sequence !== undefined) {
          latencies.push(received - (sentAt.get(message.sequence) ?? received));
        }
      });
    });
  }
}

// In batches: a burst of hundreds of simultaneous connects overflows the
// loopback accept backlog, which says nothing about the server.
const BATCH = 50;
for (let first = 0; first < CONNECTIONS; first += BATCH) {
  await Promise.all(
    Array.from({ length: Math.min(BATCH, CONNECTIONS - first) }, (_, offset) =>
      connectOne(first + offset),
    ),
  );
}

const publisher = createHubRealtimePublisher(hub);
const started = performance.now();
for (let tick = 1; tick <= TICKS; tick += 1) {
  sentAt.set(tick, performance.now());
  await publisher.marketPriceUpdated({
    assetId: ASSET,
    price: usd("101"),
    previousPrice: usd("100"),
    change: usd("1"),
    changePercent: 1,
    tickChange: usd("0.1"),
  });
  // Interval 0 saturates the server; the simulator's real rate is one tick a second.
  await new Promise((resolve) =>
    INTERVAL_MS > 0 ? setTimeout(resolve, INTERVAL_MS) : setImmediate(resolve),
  );
}
const expected = CONNECTIONS * TICKS;
while (latencies.length < expected && performance.now() - started < 60_000) {
  await new Promise((resolve) => setTimeout(resolve, 10));
}
const elapsedSeconds = (performance.now() - started) / 1000;

const sorted = [...latencies].sort((a, b) => a - b);
const row = {
  connections: CONNECTIONS,
  ticks: TICKS,
  delivered: `${latencies.length.toString()}/${expected.toString()}`,
  ticksPerSecond: Math.round(TICKS / elapsedSeconds),
  deliveriesPerSecond: Math.round(latencies.length / elapsedSeconds),
  latencyMs: {
    p50: Number(percentile(sorted, 50).toFixed(2)),
    p95: Number(percentile(sorted, 95).toFixed(2)),
    p99: Number(percentile(sorted, 99).toFixed(2)),
    max: Number((sorted.at(-1) ?? 0).toFixed(2)),
  },
  node: process.version,
};
process.stdout.write(`${JSON.stringify(row, null, 2)}\n`);

for (const socket of sockets) {
  socket.terminate();
}
await gateway.stop();
server.closeAllConnections();
server.close();
