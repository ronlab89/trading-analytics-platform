import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import type { RawData, WebSocket } from "ws";
import type { RealtimeSocket, RealtimeTransport } from "./transport.js";

/** The realtime endpoint, fixed for all clients (ADR-007 point 1). */
export const REALTIME_PATH = "/ws";

/** How long `close` waits for the clients to answer the close frame before dropping them. */
export const CLOSE_GRACE_MS = 3_000;

export interface WsTransportOptions {
  path: string;
  /** Largest inbound message; `ws` closes a socket that sends more with code 1009. */
  maxPayloadBytes: number;
  closeGraceMs?: number;
}

export interface WsTransport extends RealtimeTransport {
  /** Serves the WebSocket path on an HTTP server; any other upgrade request is dropped. */
  attach: (server: Server) => void;
}

function textOf(data: RawData): string {
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  return Buffer.from(data).toString("utf8");
}

function toRealtimeSocket(ws: WebSocket): RealtimeSocket {
  return {
    get bufferedAmount() {
      return ws.bufferedAmount;
    },
    send: (data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    },
    ping: () => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    },
    close: (code, reason) => {
      ws.close(code, reason);
    },
    onMessage: (listener) => {
      ws.on("message", (data) => {
        listener(textOf(data));
      });
    },
    onPong: (listener) => {
      ws.on("pong", listener);
    },
    onClose: (listener) => {
      ws.on("close", listener);
    },
  };
}

/**
 * The `ws` adapter of the transport port. It runs without a server of its own
 * and takes the upgrade requests of the API's HTTP server, so the WebSocket
 * shares the port (ADR-007 point 1).
 */
export function createWsTransport(options: WsTransportOptions): WsTransport {
  const { path, maxPayloadBytes, closeGraceMs = CLOSE_GRACE_MS } = options;
  const wss = new WebSocketServer({ noServer: true, maxPayload: maxPayloadBytes });
  let listener: ((socket: RealtimeSocket) => void) | undefined;

  wss.on("connection", (ws) => {
    // `ws` closes the socket itself after an error (for example 1009) and then emits "close".
    ws.on("error", () => undefined);
    if (listener === undefined) {
      ws.close(1013, "Not ready");
      return;
    }
    listener(toRealtimeSocket(ws));
  });

  return {
    onConnection(handler) {
      listener = handler;
    },

    attach(server) {
      server.on("upgrade", (request, socket, head) => {
        const { pathname } = new URL(request.url ?? "/", "http://localhost");
        if (pathname !== path) {
          socket.destroy();
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      });
    },

    close(code, reason) {
      return new Promise<void>((resolve) => {
        // Stops accepting upgrades; the clients already connected stay open until closed below.
        wss.close();
        const clients = [...wss.clients];
        if (clients.length === 0) {
          resolve();
          return;
        }

        let remaining = clients.length;
        const timer = setTimeout(() => {
          for (const client of clients) {
            client.terminate();
          }
          resolve();
        }, closeGraceMs);

        for (const client of clients) {
          client.once("close", () => {
            remaining -= 1;
            if (remaining === 0) {
              clearTimeout(timer);
              resolve();
            }
          });
          client.close(code, reason);
        }
      });
    },
  };
}
