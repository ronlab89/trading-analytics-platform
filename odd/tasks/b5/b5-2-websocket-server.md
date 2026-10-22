# B5.2 WebSocket server, authentication and limits

Source: roadmap B5; ADR-007 points 1, 2, 11, 15 and 16; ADR-005 point 13; ADR-006 point 12; `08-realtime-spec.md` §5 to §9, §48, §51, §54, §55; `09-security-spec.md` §31 to §35. Depends on: B5.1. Branch: `feat/b5-2-websocket-server`.

Working rules: tiny tasks, each approved by the user before any edit (or delegated for the whole slice); no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

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

- [ ] T1 Transport port, `ws` adapter on `/ws`, connection registry, `ws` and its types added.
- [ ] T2 Authentication handshake with the 5-second timeout and the `ACK` or `ERROR` reply.
- [ ] T3 Token expiry binding, re-authentication and the `sub` check.
- [ ] T4 Message size and rate limits, ping/pong heartbeat, outbound buffer limit.
- [ ] T5 Per-user connection cap, the shutdown step, and the `realtime.*` log events.

## Done when

Connection, authentication timeout, expiry, re-authentication, limit and cap tests pass against a real `ws` client on an ephemeral port, and the shutdown sequence closes every socket with `1001`.

## Risk

Items 2 (authentication and guards), 4 (timers, ordering, concurrent connections) and 5 (the `ws` dependency). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test.

## Log
