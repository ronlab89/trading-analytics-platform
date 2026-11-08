import type { Page, WebSocketRoute } from "@playwright/test";

/** The default `VITE_WS_URL`. */
export const WS_URL = "ws://localhost:7001/ws";

export interface RealtimeMock {
  /** Every connection the app opened, oldest first. */
  sockets: WebSocketRoute[];
  /** What the app sent over any of them. */
  received: { type?: string; channel?: string }[];
}

/**
 * Stands in for the server socket: it accepts the authentication of every connection, as a healthy
 * server does, and keeps the connections so a test can drop one or push an event through it.
 */
export async function mockRealtime(page: Page): Promise<RealtimeMock> {
  const mock: RealtimeMock = { sockets: [], received: [] };
  await page.routeWebSocket(WS_URL, (socket) => {
    mock.sockets.push(socket);
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw)) as { type?: string; channel?: string };
      mock.received.push(message);
      if (message.type === "AUTHENTICATE") {
        socket.send(JSON.stringify({ type: "ACK", request: "AUTHENTICATE" }));
      }
    });
  });
  return mock;
}
