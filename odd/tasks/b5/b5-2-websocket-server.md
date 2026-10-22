# B5.2 WebSocket server, authentication and limits

Source: roadmap B5; ADR-007 points 1, 2, 11, 15 and 16; ADR-005 point 13; ADR-006 point 12; `08-realtime-spec.md` §5 to §9, §48, §51, §54, §55; `09-security-spec.md` §31 to §35. Depends on: B5.1. Branch: `feat/b5-2-websocket-server`.

Working rules: tiny tasks, each approved by the user before any edit (or delegated for the whole slice); no subagents; the user runs tests, lint and commits unless asked.

## Allowed edit surfaces

apps/api/src/realtime/**
apps/api/src/lifecycle/**
apps/api/src/logging/**
apps/api/src/config/**
apps/api/src/index.ts
apps/api/src/composition.ts
apps/api/package.json
pnpm-lock.yaml
odd/tasks/b5/**

## Specs

- S1 A `ws` server is attached to the same HTTP server and port as the API on the fixed path `/ws`, behind a transport port so nothing else imports `ws`.
- S2 The access token arrives in the first `AUTHENTICATE` message, never in the URL; a socket not authenticated within 5 seconds is closed with `4001`; an invalid token is `4001`.
- S3 The socket is bound to the token's expiry and closed with `4002` when it passes; a new `AUTHENTICATE` over the same socket after a refresh extends the bound; another user's token (`sub` changes) is rejected and the socket closes.
- S4 Limits: 64 KiB per inbound message (`maxPayload`), 20 inbound messages per second, a 1 MB outbound buffer, a ping every 30 seconds and close after two missed pongs; a breach closes with `4008`.
- S5 At most 5 concurrent connections per user; the excess connection closes with `4008` and the existing ones stay open.
- S6 The server joins the graceful shutdown sequence (close code `1001`), and every connection logs its own `connectionId` and `userId` through the B3 logger.

## Tasks

- [x] T1 Transport port, `ws` adapter on `/ws`, connection registry, `ws` and its types added.
- [x] T2 Authentication handshake with the 5-second timeout and the `ACK` or `ERROR` reply.
- [x] T3 Token expiry binding, re-authentication and the `sub` check.
- [x] T4 Message size and rate limits, ping/pong heartbeat, outbound buffer limit.
- [x] T5 Per-user connection cap, the shutdown step, and the `realtime.*` log events.

## Done when

Connection, authentication timeout, expiry, re-authentication, limit and cap tests pass against a real `ws` client on an ephemeral port, and the shutdown sequence closes every socket with `1001`.

## Risk

Items 2 (authentication and guards), 4 (timers, ordering, concurrent connections) and 5 (the `ws` dependency). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test.

## Log

- 2026-10-21 - Decisions of B5.2:
  - The transport port (`transport.ts`) is the only surface the gateway sees; `ws-transport.ts` is the only file that imports `ws`. The adapter runs with `noServer` and takes the `upgrade` event of the API's HTTP server, so it shares the port and drops any path but `/ws`. It is created before `startServer` and attached to the server it returns, so its shutdown step registers before the HTTP step.
  - A message over 64 KiB is closed by `ws` itself with `1009` (message too big), as `08-realtime-spec.md` already says; the gateway does not close it with `4008`. Tested with a real client: 64 KiB passes, 64 KiB + 1 closes with `1009`.
  - Before authentication, anything but a valid `AUTHENTICATE` gets an `ERROR` and closes with `4001`. After it, a bad message gets `INVALID_MESSAGE` and the socket stays open.
  - An invalid token on a re-authentication, or a token of another user, replies `INVALID_TOKEN` and closes with `4001`.
  - The per-user cap counts authenticated sockets only, and the new one over the cap is the one closed with `4008`, with no `ERROR` reply.
  - The heartbeat pings every 30 s; the third tick with the first two pings unanswered closes with `4008`.
  - The outbound buffer limit is checked before each send through `connection.send`: past 1 MB the socket closes with `4008` and the message is dropped. B5.3 and B5.4 send through it.
  - `SUBSCRIBE` and `UNSUBSCRIBE` of an authenticated socket go to an optional `handleMessage`; without one the reply is `INVALID_MESSAGE`. B5.3 installs the handler.
  - The expiry comes from `exp` of the verified token (`access-token-authenticator.ts`), so a token is valid on `/ws` exactly when it is valid on an HTTP request.
  - Log events: `realtime.connection.opened`, `.authenticated`, `.auth_failed`, `.rejected`, `.limit_exceeded`, `.closed`; each carries `connectionId` and, once known, `userId`. The token is never logged.
  - Not run: the process was not started against PostgreSQL; the shutdown sequence is covered by the gateway and transport tests, not by a SIGTERM against the real process.
