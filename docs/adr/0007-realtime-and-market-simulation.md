# ADR-007: Realtime Transport and Shared Market Simulation

**Status:** Accepted
**Date:** 2026-10-04
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
   so the rest of the code does not depend on it.
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
   engine.
8. **Persistence in real mode.** Each tick updates `MarketPrice` and appends
   a `MarketEvent`, with bounded retention defined in B5. `HistoricalPrice`
   candles are not written in version 1, so analytics never mix seeded and
   simulated history. This limitation is documented.
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
    daily close, never against the previous tick. The tick-to-tick delta
    exists only in the event payload. This keeps the overview's
    `dailyChange` and ADR-004's `1D` period correct while prices tick.

## Consequences

**Positive**

- One simulation engine for both modes, deterministic and testable.
- A small event catalog where each event carries information the client
  cannot derive by itself.
- Authorization of subscriptions follows the same rules as HTTP.
- Daily change figures stay meaningful under continuous ticking.

**Negative**

- A new runtime dependency (`ws`) and a new workspace package.
- The client must recompute valuations from price events.
- Without a replay buffer, every gap costs an HTTP resynchronization.
- Simulated prices do not extend the historical series, so performance
  charts end at the last seeded candle.

**Documents to align**

- `07-api-spec.md` §31 and §36-37 (transport, event examples).
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
- **Writing simulated ticks into daily candles.** Mixes seeded and simulated
  history in analytics. Rejected for version 1.

## Related

- ADR-002 (contracts and money format), ADR-004 (`1D` period),
  ADR-005 (permissions, token refresh), ADR-008 (job events)
- `08-realtime-spec.md`, `12-demo-mode-spec.md` §36-45
