import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { capturingLogger } from "@trading/application";
import { REALTIME_LIMITS } from "@trading/contracts";
import { UserRole } from "@trading/domain";
import { systemClock } from "../clock.js";
import { createTokenService } from "../services/token.service.js";
import { createAccessTokenAuthenticator } from "./access-token-authenticator.js";
import { createRealtimeGateway } from "./realtime-gateway.js";
import type { RealtimeGateway, RealtimeLimits } from "./realtime-gateway.js";
import { REALTIME_PATH, createWsTransport } from "./ws-transport.js";

const SECRET = "integration-test-secret-integration-test-secret";

function tokenServiceWith(ttlSeconds: number) {
  return createTokenService({ secret: SECRET, ttlSeconds, clock: systemClock });
}

const tokens = tokenServiceWith(900);

interface Running {
  server: Server;
  gateway: RealtimeGateway;
  url: string;
}

const running: Running[] = [];
const clients: WebSocket[] = [];

async function start(limits: Partial<RealtimeLimits> = {}): Promise<Running> {
  const transport = createWsTransport({
    path: REALTIME_PATH,
    maxPayloadBytes: REALTIME_LIMITS.maxInboundPayloadBytes,
    closeGraceMs: 500,
  });
  const gateway = createRealtimeGateway({
    transport,
    authenticate: createAccessTokenAuthenticator(tokens),
    clock: systemClock,
    logger: capturingLogger(),
    newId: () => crypto.randomUUID(),
    limits,
  });
  gateway.start();

  const server = createServer((_request, response) => {
    response.statusCode = 404;
    response.end();
  });
  transport.attach(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const instance = {
    server,
    gateway,
    url: `ws://127.0.0.1:${(server.address() as AddressInfo).port.toString()}`,
  };
  running.push(instance);
  return instance;
}

function connect(url: string): Promise<WebSocket> {
  const client = new WebSocket(url);
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once("open", () => {
      resolve(client);
    });
    client.once("error", reject);
  });
}

function nextMessage(client: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    client.once("message", (data) => {
      resolve(JSON.parse((data as Buffer).toString("utf8")) as unknown);
    });
  });
}

function closeCode(client: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    if (client.readyState === WebSocket.CLOSED) {
      resolve(0);
      return;
    }
    client.once("close", resolve);
  });
}

function accessToken(userId = "user-1", service = tokens): string {
  return service.issue({ userId, role: UserRole.TRADER }).accessToken;
}

async function authenticated(url: string, userId = "user-1", service = tokens): Promise<WebSocket> {
  const client = await connect(url);
  const reply = nextMessage(client);
  client.send(JSON.stringify({ type: "AUTHENTICATE", accessToken: accessToken(userId, service) }));
  expect(await reply).toEqual({ type: "ACK", request: "AUTHENTICATE" });
  return client;
}

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.terminate();
  }
  for (const instance of running.splice(0)) {
    await instance.gateway.stop();
    instance.server.closeAllConnections();
    await new Promise((resolve) => instance.server.close(resolve));
  }
});

describe("the WebSocket endpoint", () => {
  it("authenticates a real client with the first message", async () => {
    const { url } = await start();

    await authenticated(`${url}${REALTIME_PATH}`);
  });

  it("refuses an upgrade on any other path", async () => {
    const { url } = await start();

    await expect(connect(`${url}/other`)).rejects.toThrow();
  });

  it("ignores a token in the URL: the socket still has to authenticate", async () => {
    const { url } = await start({ authenticationTimeoutMs: 200 });
    const client = await connect(`${url}${REALTIME_PATH}?accessToken=${accessToken()}`);

    expect(await closeCode(client)).toBe(4001);
  });

  it("closes with 4001 when the first message does not authenticate in time", async () => {
    const { url } = await start({ authenticationTimeoutMs: 100 });
    const client = await connect(`${url}${REALTIME_PATH}`);

    expect(await closeCode(client)).toBe(4001);
  });

  it("closes with 4001 for a token signed with another secret", async () => {
    const { url } = await start();
    const client = await connect(`${url}${REALTIME_PATH}`);
    const forged = createTokenService({
      secret: "another-secret-another-secret-another-secret",
      ttlSeconds: 900,
      clock: systemClock,
    }).issue({ userId: "user-1", role: UserRole.TRADER });

    const reply = nextMessage(client);
    client.send(JSON.stringify({ type: "AUTHENTICATE", accessToken: forged.accessToken }));

    expect(await reply).toMatchObject({ type: "ERROR", code: "INVALID_TOKEN" });
    expect(await closeCode(client)).toBe(4001);
  });

  it("closes with 4002 when the token expires", async () => {
    const { url } = await start();
    const client = await authenticated(`${url}${REALTIME_PATH}`, "user-1", tokenServiceWith(1));

    expect(await closeCode(client)).toBe(4002);
  });

  it("closes with 1009 a message over 64 KiB", async () => {
    const { url } = await start();
    const client = await authenticated(`${url}${REALTIME_PATH}`);

    client.send("x".repeat(REALTIME_LIMITS.maxInboundPayloadBytes + 1));

    expect(await closeCode(client)).toBe(1009);
  });

  it("accepts a message of exactly 64 KiB", async () => {
    const { url } = await start();
    const client = await authenticated(`${url}${REALTIME_PATH}`);
    const reply = nextMessage(client);

    client.send("x".repeat(REALTIME_LIMITS.maxInboundPayloadBytes));

    expect(await reply).toMatchObject({ type: "ERROR", code: "INVALID_MESSAGE" });
  });

  it("closes with 4008 after 20 messages in a second", async () => {
    const { url } = await start();
    const client = await authenticated(`${url}${REALTIME_PATH}`);

    for (let count = 0; count < REALTIME_LIMITS.maxInboundMessagesPerSecond; count += 1) {
      client.send("{}");
    }

    expect(await closeCode(client)).toBe(4008);
  });

  it("closes the sixth connection of a user with 4008 and keeps the first five", async () => {
    const { url } = await start();
    const first = await Promise.all(
      Array.from({ length: REALTIME_LIMITS.maxConnectionsPerUser }, () =>
        authenticated(`${url}${REALTIME_PATH}`),
      ),
    );
    const excess = await connect(`${url}${REALTIME_PATH}`);

    excess.send(JSON.stringify({ type: "AUTHENTICATE", accessToken: accessToken() }));

    expect(await closeCode(excess)).toBe(4008);
    expect(first.every((client) => client.readyState === WebSocket.OPEN)).toBe(true);
  });

  it("pings the client, and a ws client answers with a pong", async () => {
    const { url } = await start({ heartbeatIntervalMs: 50 });
    const client = await authenticated(`${url}${REALTIME_PATH}`);
    const ping = new Promise<void>((resolve) => client.once("ping", resolve));

    await ping;

    // A ws client pongs by itself, so the connection survives past two intervals.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("closes every connection with 1001 on shutdown", async () => {
    const { url, gateway } = await start();
    const client = await authenticated(`${url}${REALTIME_PATH}`);
    const anonymous = await connect(`${url}${REALTIME_PATH}`);
    const codes = Promise.all([closeCode(client), closeCode(anonymous)]);

    await gateway.stop();

    expect(await codes).toEqual([1001, 1001]);
  });
});
