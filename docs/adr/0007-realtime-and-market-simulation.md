# ADR-007: Realtime Transport and Shared Market Simulation

**Status:** Accepted
**Date:** 2026-10-04
**Amended:** 2026-10-07 (points 1 and 16, approved by the user from the
`14-deployment-spec.md` reconciliation; Deferred detail rows; point 7,
package location, approved by the user from the `15-implementation-plan.md`
reconciliation; new point 17, event hand-off, approved by the user on
2026-10-08 from the `15-implementation-plan.md` reconciliation; Deferred
detail `maxPayload` value, 64 KiB, approved by the user on 2026-10-08)
**Implemented in:** roadmap block B5 (not yet implemented)

## Context

`08-realtime-spec.md` §2 commits to WebSockets, while `07-api-spec.md` §31
leaves the transport open. `08-realtime-spec.md` §15 lists eleven event
types. Several are redundant under earlier decisions:

- Transactions are synchronous, so `TRANSACTION_CREATED` and
  `TRANSACTION_COMPLETED` tell the client nothing it does not already know.
- Pushing a recomputed valuation per portfolio on every price tick scales
  with every connected user, while the client can recompute from prices.

The market price event example in `08-realtime-spec.md` §16 sends money as
JSON numbers, which contradicts ADR-002.

`12-demo-mode-spec.md` §36-40 requires a market simulator with modes,
deterministic scenarios and a controllable clock. There is no paid market
data provider (`04-tech-stack.md` §47-48), so the real backend also needs a
simulated price source. Two separate engines would drift.

Persistence already exists: `MarketPrice` holds the current price per asset
and `MarketEvent` has a `sequence` column indexed by asset. The seed sets
`MarketPrice.previousPrice` to the previous daily close, which is what the
overview's `dailyChange` and ADR-004's `1D` period rely on.

## Decision

1. **Transport.** WebSocket using the `ws` library, behind a transport port
   so the rest of the code does not depend on it. (Amended 2026-10-07,
   approved by the user from the `14-deployment-spec.md` reconciliation,
   §10, §31, §72; `Planned (B5)`:) The WebSocket is served by the same HTTP
   server and port as the API (7001) on a fixed path, proposed `/ws` and
   confirmed in B5. There is no `WEBSOCKET_PATH` variable.
2. **Authentication.** The client sends the access token in the first
   message, never in the URL. A connection not authenticated within 5
   seconds is closed. Each socket is bound to the expiry of the token it
   authenticated with. After a token refresh (ADR-005) the client
   re-authenticates over the same socket, which extends that bound. If the
   token expires without re-authentication, the server closes the socket.
   Every re-authentication reloads role and ownership and drops any
   subscription the actor is no longer allowed to hold, so role changes take
   effect within the same 15-minute window as HTTP.
   *Corrected on 2026-10-04 after review:* the original text validated the
   token only once, so a socket could stay authorized indefinitely.
3. **Channels.** `market:{assetId}`, `portfolio:{portfolioId}` and
   `notifications` (scoped to the authenticated user). Every subscription is
   authorized in the application layer by permission and ownership
   (ADR-001, ADR-005).
4. **Envelope.** `{ id, type, channel, sequence, timestamp, payload }`,
   defined as Zod schemas in `@trading/contracts` (ADR-002). Money follows
   the ADR-002 wire format.
5. **Ordering.** `sequence` is monotonic per channel. On a gap the client
   resynchronizes through HTTP. There is no server-side replay buffer in
   version 1.
6. **Event catalog, version 1.**
   - `MARKET_PRICE_UPDATED`
   - `PORTFOLIO_UPDATED`, emitted only when holdings change (after a
     transaction commits)
   - `NOTIFICATION_CREATED`
   - `ALERT_TRIGGERED`
   Job events depend on ADR-008. `TRANSACTION_CREATED`,
   `TRANSACTION_COMPLETED` and `POSITION_UPDATED` are removed.
7. **Simulation engine.** A pure, deterministic package
   `@trading/market-sim` with a seeded pseudo-random generator, an injected
   clock, and the modes and scenarios of `12-demo-mode-spec.md` §37-40. It
   depends only on `@trading/domain`. The API and the demo use the same
   engine. The package lives at `packages/market-sim` (added 2026-10-07,
   approved by the user).
8. **Persistence in real mode.** Each tick updates `MarketPrice` and appends
   a `MarketEvent`, with bounded retention defined in B5. At every UTC day
   rollover the simulator closes a daily `HistoricalPrice` candle for each
   asset and rolls `MarketPrice.previousPrice` to that close. Seed candles
   end the day before the seed runs, using dates relative to the seed run,
   not a fixed date. On startup the simulator deterministically generates
   the candles for the days the server was offline, so the daily series has
   no gaps. In real mode every price is synthetic (the seed is `MOCK` data
   too), so there is no real history for simulated candles to contaminate.
   *Point 8 corrected on 2026-10-04 after a systematic audit:* the original
   text never wrote candles and the seed ended on a fixed date, so the value
   series froze at the last seeded close. A purchase at a simulated price of
   150 was valued at a carried-forward close of 100 (a false −33%), and
   `previousPrice` never rolled over.
9. **Alerts.** Evaluated on every tick, but edge-triggered: an alert fires
   when its condition changes from false to true, and re-arms when it
   becomes false again. Alerts never repeat on every tick (FR-053). Each
   trigger creates a notification and emits `ALERT_TRIGGERED` and
   `NOTIFICATION_CREATED`.
10. **Control.** Starting, pausing and changing the simulation mode require
    the `simulation:control` permission (`ADMIN`, ADR-005).
11. **Limits.** Maximum subscriptions per connection, an inbound message
    rate limit, a ping/pong heartbeat every 30 seconds, and bounded memory
    per connection.
12. **Degradation.** When the socket is down, the UI shows a stale-data
    indicator and refetches through HTTP periodically until it reconnects.
13. **Demo.** An in-process realtime adapter implements the same client-side
    port, fed by `@trading/market-sim` running in the browser.
14. **`MarketPrice` change semantics.** `previousPrice`, `change` and
    `changePercent` on `MarketPrice` are always measured against the last
    closed daily candle (point 8), never against the previous tick. The
    tick-to-tick delta exists only in the event payload. This keeps the
    overview's
    `dailyChange` and ADR-004's `1D` period correct while prices tick.
15. **Protocol and simulation details** (added 2026-10-06, approved by the
    user, from the `08-realtime-spec.md` reconciliation):
    - **Alert channel.** `ALERT_TRIGGERED` is delivered on `notifications`,
      because alerts are user-scoped.
    - **Cancelled and timed-out jobs.** `CANCELLED` and `TIMED_OUT` emit no
      realtime event. Clients learn them from the job's HTTP status, and
      `TIMED_OUT` also from its import notification (ADR-008 point 6;
      `CANCELLED` creates none). The three job events of ADR-008 point 11
      are unchanged.
    - **Protocol messages.** Client messages are `AUTHENTICATE`,
      `SUBSCRIBE` and `UNSUBSCRIBE`. The server replies `ACK` or `ERROR`;
      `ERROR` carries a `code`.
    - **Close codes.** `4001` unauthenticated or invalid token, including
      the 5-second authentication timeout (point 2); `4002` token expired;
      `4008` limit exceeded; `1001` server going away.
    - **Limit values** (point 11). 50 subscriptions per connection; 20
      inbound messages per second per connection; 1 MB outbound buffer per
      connection. With a ping every 30 seconds, the server closes the
      socket after 2 consecutive missed pongs (about 60 seconds).
    - **`tickChange`.** The tick-to-tick delta in `MARKET_PRICE_UPDATED`
      (point 14) keeps the name `tickChange`.
    - **Control endpoints** (point 10). `POST /api/v1/simulation/start`,
      `POST /api/v1/simulation/pause` and `PUT /api/v1/simulation/mode` with
      body `{ "mode": "<wire id>" }`, all requiring `simulation:control`.
      Errors follow ADR-002 point 10.
    - **Real-mode lifecycle.** Only `RUNNING <-> HALTED` (renamed from
      `PAUSED` by point 16). Real mode has no
      stop and no seed reset; reset belongs to the frontend-stage demo ADR
      (ADR-010 point 6).
    - **Timing.** The simulator ticks every 1 second. While the socket is
      down, the client polls HTTP every 10 seconds (point 12).
    - **Wire identifiers.** SCREAMING_SNAKE_CASE. Modes: `PAUSED`,
      `NORMAL`, `VOLATILE`, `BULLISH`, `BEARISH`. Scenarios:
      `STABLE_MARKET`, `BULLISH_SESSION`, `VOLATILE_SESSION`,
      `SHARP_DRAWDOWN`, `RECOVERY`.
16. **Lifecycle state name and connection cap** (added 2026-10-06, approved
    by the user, from the `09-security-spec.md` and `08-realtime-spec.md`
    reconciliation):
    - **`HALTED`.** The internal lifecycle state is `HALTED`, not `PAUSED`.
      `PAUSED` stays only as a mode wire identifier (point 15), so the two
      no longer share a name. The lifecycle is `RUNNING <-> HALTED`.
      `POST /api/v1/simulation/pause` moves `RUNNING` to `HALTED` and
      `POST /api/v1/simulation/start` moves `HALTED` to `RUNNING`; the
      endpoint paths are unchanged.
    - **Connection cap.** Concurrent WebSocket connections are capped per
      authenticated user, not per IP (ADR-005 point 13; v1 value 5, tuned
      in B5). (Amended 2026-10-07, approved by the user from the
      `14-deployment-spec.md` reconciliation:) When a user is at the cap,
      the new (excess) connection is closed with `4008` (point 15); the
      existing connections stay open.
17. **Event hand-off** (added 2026-10-08, approved by the user, from the
    `15-implementation-plan.md` reconciliation, §31; `Planned (B5)`). The
    application layer hands an event to the realtime adapter through a
    `RealtimePublisher` port in `packages/application`; the adapter that
    implements it lives in `apps/api`, behind the transport port of point 1.
    Application services publish after the change commits (point 6, for
    example `PORTFOLIO_UPDATED` after a transaction commits). Version 1 has no
    domain events and no event bus; the "Domain event" and "Application event"
    steps of the original sketch in `08-realtime-spec.md` and
    `15-implementation-plan.md` §31 collapse into this one call. The demo
    implements the same port in process (point 13).

## Consequences

**Positive**

- One simulation engine for both modes, deterministic and testable.
- A small event catalog where each event carries information the client
  cannot derive by itself.
- Authorization of subscriptions follows the same rules as HTTP.
- Daily change figures stay meaningful under continuous ticking.
- The daily candle series extends without gaps while the server runs and
  across downtime, so performance charts and valuations stay current.

**Negative**

- A new runtime dependency (`ws`) and a new workspace package.
- The client must recompute valuations from price events.
- Without a replay buffer, every gap costs an HTTP resynchronization.
- The simulator owns a daily rollover job and a startup backfill, and the
  seed must compute relative dates.

**Documents to align**

- `07-api-spec.md` §31 and §36-37 (transport, event examples), and §54
  (control endpoints, point 15).
- `08-realtime-spec.md` (catalog, envelope, money format, auth handshake).
- `09-security-spec.md` §31-35 (realtime security).
- `12-demo-mode-spec.md` §36-45 (shared engine, alert behavior).
- `05-data-model.md` (`MarketPrice` change semantics).

## Alternatives Considered

- **Socket.IO.** Adds its own protocol and transport fallbacks that a
  modern browser target does not need. Rejected.
- **Server-Sent Events.** One-way; subscription management would need a
  parallel HTTP channel. Rejected.
- **Server-pushed portfolio valuations on every tick.** Cost grows with
  connected users for data the client can compute. Rejected.
- **Separate simulators for server and demo.** Guaranteed drift. Rejected.
- **Writing every simulated tick into daily candles.** Rewrites the current
  day's candle on every tick for no analytical gain. Rejected. Closing one
  daily candle at the UTC rollover is adopted instead (point 8).
- **Never writing simulated candles.** Freezes the value series at the last
  seeded close and misvalues recent purchases. Rejected after the audit.

## Deferred detail

Implementation edge cases that do not change this decision. Each is
specified and tested in the listed block.

| Item | Resolution | Block |
|---|---|---|
| `Position.currentPrice` stays at the opening trade price while `MarketPrice` ticks, so allocation and value disagree with `dailyChange`. | Drop `Position.currentPrice` and read `MarketPrice` at query time, or update it on every tick. | B5 |
| Events between the HTTP fetch and the subscription are lost; a job can finish before `jobs:{id}` is subscribed; in-memory sequences restart at 1 after a server restart. | Subscribe first and buffer, then fetch a snapshot carrying its sequence. Add a per-process epoch to the envelope; the client resets its baseline when it changes. | B5 |
| Alert armed/triggered state is not persisted (re-fires after restart), oscillation around the threshold fires repeatedly, and the initial state of a new, already-true alert is undefined. | Persist `armed` and `lastTriggeredAt` in the same transaction as the notification. Re-arm only past a hysteresis band or after a cooldown. Define the initial state. | B5 |
| After a restart the simulator restarts from the seed state and `MarketEvent.sequence` restarts. | Initialize the engine from persisted `MarketPrice` and `MAX(sequence)` per asset. Make `(assetId, sequence)` unique. | B5 |
| Re-authentication on the same socket with another user's token keeps the previous user's `notifications` subscription. | Reject re-authentication when `sub` changes and close the socket. | B5 |
| The byte size of the WebSocket `maxPayload` was not set, and the `ws` library defaults to 100 MiB when it is unset. | (Amended 2026-10-08, approved by the user) `maxPayload` starts at 64 KiB (65,536 bytes) per inbound message. It is an initial value, adjustable during B5 if a measured need appears. The inbound messages (`AUTHENTICATE`, `SUBSCRIBE`, `UNSUBSCRIBE`, ping and pong) are tiny, and the default would leave inbound frames practically unbounded. | B5 |
| The realtime hub could be tied to the transport or to a broker. | It sits behind its own interface, and v1 has no broker. | B5 |
| The application layer has no defined way to hand an event to the realtime adapter. | Point 17 (added 2026-10-08): the `RealtimePublisher` port in `packages/application`, its adapter in `apps/api`, no domain events in v1. Tests: a transaction service test with an in-memory publisher fake asserts `PORTFOLIO_UPDATED` is published only after commit. | B5 |
| What the `PAUSED` mode does (point 16 renamed the lifecycle state to `HALTED`): whether `PUT /api/v1/simulation/mode` with `PAUSED` stops ticking like `POST /api/v1/simulation/pause`, and which mode `start` resumes into. | Define the `PAUSED` mode's behavior relative to `HALTED`, and which mode `start` resumes. | B5 |

## Related

- ADR-002 (contracts and money format), ADR-004 (`1D` period),
  ADR-005 (permissions, token refresh), ADR-008 (job events)
- `08-realtime-spec.md`, `12-demo-mode-spec.md` §36-45
