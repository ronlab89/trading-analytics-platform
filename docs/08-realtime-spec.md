# SDD 08 — Realtime Specification

**Project:** Trading Analytics Platform  
**Status:** All sections reconciled with the code and ADRs on 2026-10-06 (task T4.2)  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`, `05-data-model.md`, `06-architecture.md`, `07-api-spec.md`

---

# 1. Purpose

**Status:** `Reference`

This document owns the realtime protocol of Trading Analytics Platform:
transport, handshake, channels, envelope, event catalog, ordering,
reconnection and limits. `07-api-spec.md` §31-§38 only summarize it.
Nothing here is implemented yet; the server side is built in B5 (ADR-007)
and the client side in the frontend stage.

Realtime covers:

- live market prices from the shared simulator (ADR-007 point 7);
- portfolio changes after a transaction commits;
- CSV import job progress (ADR-008 point 11);
- notifications and triggered alerts;
- connection state, reconnection, ordering and stale-event protection.

The demo reproduces the same contract in process, without an external
realtime provider (ADR-007 point 13).

---

# 2. Realtime Technology

**Status:** `Planned (B5)` (ADR-007 point 1)

The server uses WebSocket through the `ws` library, behind a transport port
so no other code depends on it. The WebSocket is served by the same HTTP
server and port as the API (7001) on a fixed path, proposed `/ws` and
confirmed in B5; there is no `WEBSOCKET_PATH` variable (ADR-007 point 1,
amended 2026-10-07). Socket.IO and Server-Sent Events are
rejected (ADR-007, Alternatives Considered).

On the server, after a change commits, the application layer calls the
`RealtimePublisher` port; the adapter that implements it lives in `apps/api`
and publishes to the socket behind the transport port. Version 1 has no
domain events and no event bus (ADR-007 point 17).

The UI never depends on the WebSocket implementation:

```text
UI
 ↓
Realtime Client (client port)
 ↓
Realtime Adapter
 ↓
WebSocket Transport | In-process demo adapter
```

---

# 3. Realtime Principles

**Status:** `Reference`

1. Transport is infrastructure.
2. Events use the contracts in `@trading/contracts` (ADR-002).
3. Raw WebSocket messages never leak into feature modules.
4. Events are validated before entering application state.
5. `sequence` orders events per channel.
6. Stale events never overwrite newer state.
7. Reconnection is automatic.
8. Realtime failure degrades to HTTP refetching (ADR-007 point 12).
9. Unrelated UI does not re-render.
10. Demo Mode reproduces the same event contract.
11. An event carries only what the client cannot derive itself; valuations
    are recomputed on the client from prices (ADR-007).

---

# 4. Realtime Architecture

**Status:** `Planned (FE)`

```text
                  ┌──────────────────────┐
                  │     React Client     │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Realtime Client      │
                  │ Connection Manager   │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Event Normalizer     │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Application Events   │
                  └──────────┬───────────┘
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
          Server State              Client State
          / Query Cache             / Zustand
                 │                       │
                 └───────────┬───────────┘
                             ▼
                            UI
```

---

# 5. Transport Abstraction

**Status:** client port `Planned (FE)`; server transport port `Planned (B5)` (ADR-007 points 1 and 13)

The client depends on a transport-independent port:

```text
RealtimeTransport
  connect()
  disconnect()
  subscribe(channel)
  unsubscribe(channel)
  send(message)
  getConnectionState()
```

Implementations:

```text
WebSocketRealtimeTransport   real mode
InProcessRealtimeTransport   demo, fed by @trading/market-sim in the browser
```

Both satisfy the same contract. Adapter class names are decided in FE.

---

# 6. Connection States

**Status:** `Planned (FE)`

```text
DISCONNECTED
CONNECTING
CONNECTED
RECONNECTING
FAILED
```

`CONNECTED` means the socket is open and authenticated (§9). These are
client transport states, not domain entities (`07-api-spec.md` §37).

---

# 7. Connection Lifecycle

**Status:** client transitions `Planned (FE)`; heartbeat and limits `Planned (B5)` (ADR-007 points 2, 11 and 15)

Client transitions:

```text
DISCONNECTED → CONNECTING → CONNECTED
CONNECTING   → RECONNECTING → CONNECTED
CONNECTED    → RECONNECTING      (unintended socket loss, §42)
CONNECTED    → DISCONNECTED      (intentional close, no reconnection, §54)
RECONNECTING → FAILED
FAILED       → CONNECTING        (manual retry)
```

Server rules (ADR-007 point 15):

| Rule | Value |
|---|---|
| Heartbeat | WebSocket ping every 30 s; socket closed after 2 consecutive missed pongs (about 60 s) |
| Subscriptions per connection | 50 |
| Inbound messages per connection | 20 per second |
| Inbound message size (`maxPayload`) | 64 KiB (65,536 bytes) |
| Outbound buffer per connection | 1 MB |
| Concurrent connections per authenticated user (not per IP) | 5, `Planned (B5)` (ADR-005 point 13, ADR-007 point 16); numeric value tuned in B5 |

- When the server closes a socket for exceeding a limit, it uses close
  code `4008` (§9). An excess connection beyond the per-user cap of 5 is
  closed with `4008` (ADR-005 point 13). The excess connection is the new
  one; existing connections stay open (ADR-007 point 16, amended
  2026-10-07).
- The WebSocket `maxPayload` is 64 KiB (65,536 bytes) per inbound message,
  an initial value adjustable during B5 if a measured need appears
  (ADR-007 Deferred detail, amended 2026-10-08, `Planned (B5)`). A larger
  frame closes the connection, which is the behavior of the `ws` library.
  The close code for an oversize frame is an open detail of B5.
- The server closes a socket not authenticated within 5 seconds (`4001`),
  or whose token expired without re-authentication (`4002`) (§9).

Open details (B5):

- The close code for a missed-pong close. ADR-007 assigns none, and the
  custom codes of §9 do not cover it.
- Whether a `SUBSCRIBE` beyond the subscription limit is refused with an
  `ERROR` reply or closes the socket with `4008`.
- Outbound buffer overflow handling (§48).

---

# 8. Initial Connection

**Status:** `Planned (FE)`

When an authenticated session starts:

```text
Application Bootstrap
        ↓
Initialize Realtime Client
        ↓
Open socket
        ↓
Authenticate (first message, within 5 s)
        ↓
Subscribe required channels
```

The application never assumes the connection is immediately available.

---

# 9. Authentication

**Status:** `Planned (B5)` (ADR-007 points 2 and 15, ADR-005)

- The first client message carries the access token; the token is never
  put in the URL.
- A socket not authenticated within 5 seconds is closed.
- The socket is bound to the expiry of the token it authenticated with.
- After a token refresh (ADR-005) the client re-authenticates over the same
  socket, which extends the bound. If the token expires without
  re-authentication, the server closes the socket.
- Every re-authentication reloads role and ownership and drops any
  subscription the actor may no longer hold, so role changes take effect
  within the same 15-minute window as HTTP.
- Re-authentication with another user's token (`sub` changes) is rejected
  and the socket is closed (ADR-007 Deferred detail, B5).

Authentication message, shape only:

```json
{ "type": "AUTHENTICATE", "accessToken": "..." }
```

Protocol (ADR-007 point 15), defined as Zod schemas in `@trading/contracts`:

- Client messages: `AUTHENTICATE`, `SUBSCRIBE`, `UNSUBSCRIBE` (§10).
- Server replies: `ACK`, or `ERROR` carrying a `code`.

| Close code | Meaning |
|---|---|
| `4001` | Unauthenticated or invalid token, including the 5-second authentication timeout |
| `4002` | Token expired without re-authentication |
| `4008` | Limit exceeded (§7), including an excess connection beyond the per-user cap of 5 (`Planned (B5)`) |
| `1001` | Server going away |

Open detail (B5): the `ACK` and `ERROR` field shapes and the set of `ERROR`
codes.

---

# 10. Channel Model

**Status:** `Planned (B5)` (ADR-007 point 3, ADR-008 point 11)

| Channel | Scope | Authorization |
|---|---|---|
| `market:{assetId}` | One asset's prices | Any authenticated actor |
| `portfolio:{portfolioId}` | One portfolio | Ownership |
| `notifications` | The authenticated user | Implicit; no id in the name |
| `jobs:{jobId}` | One CSV import job | Ownership |

Every subscription is authorized in the application layer by permission and
ownership (ADR-001, ADR-005); an unauthorized or unknown channel is refused.
`user:{userId}` and `notifications:{userId}` are removed.

Subscription messages, shape only:

```json
{ "type": "SUBSCRIBE", "channel": "market:asset_001" }
```

```json
{ "type": "UNSUBSCRIBE", "channel": "market:asset_001" }
```

Feature modules subscribe through the realtime client, never directly.

---

# 11. Market Data Channel

**Status:** `Planned (B5)` (ADR-007 points 3 and 7)

`market:{assetId}` carries `MARKET_PRICE_UPDATED` (§16) from the shared
simulator. The client subscribes only to the assets it currently shows, not
to every asset.

---

# 12. Portfolio Channel

**Status:** `Planned (B5)` (ADR-007 points 3 and 6)

`portfolio:{portfolioId}` carries only `PORTFOLIO_UPDATED` (§18), emitted
when holdings change after a transaction commits. Price-driven valuation
changes are not pushed; the client recomputes them from market events.

---

# 13. Job Channel

**Status:** `Planned (B5)` (ADR-008 point 11)

`jobs:{jobId}` carries the CSV import job events (§20), so the UI follows
progress without polling. A job can finish before the subscription exists;
the client then reads the final state through `GET /api/v1/jobs/:jobId`
(ADR-007 Deferred detail).

The job lifecycle itself lands in B4 (ADR-008); its events are `Planned
(B5)` because they need the WebSocket transport of B5 (ADR-007), and
`BACKEND-ROADMAP.md` lists job event producers in the B5 scope.

---

# 14. Event Envelope

**Status:** `Planned (B5)` (ADR-007 points 4 and 5, ADR-002)

```json
{
  "id": "event_001",
  "type": "MARKET_PRICE_UPDATED",
  "channel": "market:asset_001",
  "sequence": 1024,
  "timestamp": "2026-08-29T14:30:00Z",
  "payload": {}
}
```

- All six fields are required on every server event.
- `sequence` is a monotonic integer per channel (§24).
- `timestamp` is an ISO-8601 UTC string; money and prices are decimal
  strings (ADR-002).
- Defined as Zod schemas in `@trading/contracts`.
- A per-process epoch field, so clients reset their baseline after a server
  restart, is added in B5 (ADR-007 Deferred detail).

---

# 15. Event Types

**Status:** `Planned (B5)` (ADR-007 points 6 and 15, ADR-008 point 11)

Catalog, version 1:

| Type | Channel |
|---|---|
| `MARKET_PRICE_UPDATED` | `market:{assetId}` |
| `PORTFOLIO_UPDATED` | `portfolio:{portfolioId}` |
| `JOB_PROGRESS_UPDATED` | `jobs:{jobId}` |
| `JOB_COMPLETED` | `jobs:{jobId}` |
| `JOB_FAILED` | `jobs:{jobId}` |
| `NOTIFICATION_CREATED` | `notifications` |
| `ALERT_TRIGGERED` | `notifications` (ADR-007 point 15) |

Removed: `POSITION_UPDATED`, `TRANSACTION_CREATED` and
`TRANSACTION_COMPLETED` (ADR-007 point 6), and `JOB_CREATED` (not in
ADR-008 point 11). A new event requires a new decision.

---

# 16. Market Price Event

**Status:** `Planned (B5)` (ADR-007 points 6 and 14, ADR-002)

```json
{
  "id": "event_001",
  "type": "MARKET_PRICE_UPDATED",
  "channel": "market:asset_001",
  "sequence": 1201,
  "timestamp": "2026-08-29T14:30:00Z",
  "payload": {
    "assetId": "asset_001",
    "price": { "amount": "184.22", "currency": "USD" },
    "previousPrice": { "amount": "182.10", "currency": "USD" },
    "change": { "amount": "2.12", "currency": "USD" },
    "changePercent": 1.16,
    "tickChange": { "amount": "0.32", "currency": "USD" }
  }
}
```

- Money fields (`price`, `previousPrice`, `change`, `tickChange`) use the
  ADR-002 wire format `{ "amount": "184.22", "currency": "USD" }`, where
  `amount` is a decimal string. `changePercent` is a percentage and is a
  JSON number, for display only (ADR-002 point 3).
- `previousPrice`, `change` and `changePercent` match `MarketPrice`: they
  are measured against the last closed daily candle, never the previous
  tick (ADR-007 point 14).
- `tickChange` is the tick-to-tick delta, which exists only in this event.

---

# 17. Position Update Event

**Status:** `Deferred` (removed by ADR-007 point 6)

`POSITION_UPDATED` is not emitted. Position values follow from market
events (§16), and holdings changes from `PORTFOLIO_UPDATED` (§18).

---

# 18. Portfolio Update Event

**Status:** server event `Planned (B5)`; client reaction `Planned (FE)` (ADR-007 point 6)

```json
{
  "type": "PORTFOLIO_UPDATED",
  "channel": "portfolio:portfolio_001",
  "payload": {
    "portfolioId": "portfolio_001",
    "reason": "TRANSACTION_COMMITTED"
  }
}
```

Envelope fields `id`, `sequence` and `timestamp` are omitted from this and
the following examples. Emitted only after a transaction commits. It does
not carry the portfolio; the client invalidates and refetches it through
HTTP.

---

# 19. Transaction Events

**Status:** `Deferred` (removed by ADR-007 point 6 and ADR-008 point 12)

Transactions are created synchronously; the HTTP response is the result.
There is no asynchronous transaction lifecycle and no `TRANSACTION_CREATED`
or `TRANSACTION_COMPLETED` event. Deposits and withdrawals do not exist
(ADR-003), so they emit no events.

---

# 20. Background Job Events

**Status:** `Planned (B5)` (ADR-008 points 3, 6 and 11, ADR-007 point 15)

Events on `jobs:{jobId}` for CSV import jobs:

| Type | When | Payload |
|---|---|---|
| `JOB_PROGRESS_UPDATED` | Progress changes while `PROCESSING` | `jobId`, `status`, `progress` |
| `JOB_COMPLETED` | Job reaches `COMPLETED` | `jobId`, `status` |
| `JOB_FAILED` | Job reaches `FAILED` | `jobId`, `status`, `reason` |

```json
{
  "type": "JOB_PROGRESS_UPDATED",
  "channel": "jobs:job_001",
  "payload": {
    "jobId": "job_001",
    "status": "PROCESSING",
    "progress": { "processed": 60, "total": 100 }
  }
}
```

- `status` uses the job states of ADR-008 point 3: `QUEUED`, `PROCESSING`,
  `COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`.
- Progress is the `{ processed, total }` field, not a percentage
  (`07-api-spec.md` §15).
- `reason` is one of `VALIDATION_FAILED`, `INTERRUPTED`, `APPLY_ERROR`,
  `APPLY_REJECTED`, `PORTFOLIO_ARCHIVED` (ADR-008 point 6).
- `CANCELLED` and `TIMED_OUT` emit no realtime event (ADR-007 point 15).
  The client learns both from the job's HTTP status
  (`GET /api/v1/jobs/:jobId`), and `TIMED_OUT` also from its `ERROR`
  notification (§21). `CANCELLED` creates no notification, because the
  user caused it (ADR-008 point 6).

---

# 21. Notification Events

**Status:** server event `Planned (B5)`; client fetch `Planned (FE)` (ADR-007 point 9, ADR-010 point 9)

```json
{
  "type": "NOTIFICATION_CREATED",
  "channel": "notifications",
  "payload": {
    "notificationId": "notification_001"
  }
}
```

Sources: a triggered alert (`WARNING`), and a CSV import job reaching
`COMPLETED` (`SUCCESS`), `FAILED` or `TIMED_OUT` (`ERROR`). `CANCELLED` jobs
and connection changes create none. The client fetches the notification
through `07-api-spec.md` §28.

---

# 22. Alert Events

**Status:** `Planned (B5)` (ADR-007 points 9 and 15)

```json
{
  "type": "ALERT_TRIGGERED",
  "channel": "notifications",
  "payload": {
    "alertId": "alert_001",
    "assetId": "asset_001",
    "condition": "ABOVE",
    "threshold": { "amount": "200.00", "currency": "USD" },
    "price": { "amount": "200.15", "currency": "USD" }
  }
}
```

- Edge-triggered: fires when the condition changes from false to true, and
  re-arms when it becomes false again; never on every tick (FR-053).
- Each trigger also creates a `WARNING` notification and emits
  `NOTIFICATION_CREATED`.
- `threshold` and `price` are money in the ADR-002 wire format
  (`{ "amount": "<decimal string>", "currency": "USD" }`).

Decided in ADR-007 point 15 (2026-10-06):

| Topic | Decision | Section |
|---|---|---|
| Channel of `ALERT_TRIGGERED` | `notifications`, because alerts are user-scoped | §15 |
| `CANCELLED` and `TIMED_OUT` jobs | No realtime event; the client reads the job's HTTP status (and the `TIMED_OUT` notification) | §20 |
| Protocol messages and close codes | `AUTHENTICATE`, `SUBSCRIBE`, `UNSUBSCRIBE`; `ACK` and `ERROR` with a `code`; `4001`, `4002`, `4008`, `1001` | §9 |
| Limits and missed pongs | 50 subscriptions, 20 inbound messages per second, 1 MB outbound buffer; closed after 2 missed pongs | §7 |

---

# 23. Event Validation

**Status:** `Planned (FE)` (ADR-007 point 4, ADR-002)

The client parses every incoming event with the `@trading/contracts` Zod
schemas before it reaches application state:

- envelope: all six fields of §14 present and well typed;
- `type` is in the version 1 catalog (§15) and matches its `channel`;
- `payload` matches the schema for `type`, including decimal-string money;
- `channel` is one the client is subscribed to.

An event that fails validation is dropped and logged; it never updates
state and does not advance `lastProcessedSequence`.

---

# 24. Event Ordering

**Status:** server `Planned (B5)`; client `Planned (FE)` (ADR-007 point 5, NFR-018)

`sequence` is monotonic per channel. The client keeps one
`lastProcessedSequence` per channel and applies an event only when:

```text
incomingSequence > lastProcessedSequence
```

An event with `incomingSequence <= lastProcessedSequence` is a duplicate or
stale event and is discarded (NFR-018).

---

# 25. Event Gaps

**Status:** `Planned (FE)` (ADR-007 point 5)

A gap exists when `incomingSequence > lastProcessedSequence + 1`:

```text
sequence 101
sequence 102
sequence 105   -> 103 and 104 missing
```

On a gap the client resynchronizes that channel through HTTP (§26). There
is no server-side replay buffer in version 1, so missed events are never
replayed (ADR-007 point 5).

---

# 26. State Resynchronization

**Status:** `Planned (FE)` (ADR-007 point 5 and Deferred detail, NFR-018)

```text
Gap, reconnect or epoch change
      ↓
HTTP refetch of the affected resources
      ↓
Authoritative state
      ↓
lastProcessedSequence reset from the snapshot
```

- Triggers: a `sequence` gap (§25), every reconnect (§27), and a change of
  the per-process epoch (§14).
- HTTP is the authoritative source; realtime events only update or
  invalidate it.
- Subscribe first and buffer, then fetch a snapshot carrying its sequence,
  so events between fetch and subscription are not lost (ADR-007 Deferred
  detail, B5).

---

# 27. Reconnection Strategy

**Status:** `Planned (FE)` (NFR-018)

- Exponential backoff starting at 1 s and doubling each attempt
  (1 s, 2 s, 4 s, 8 s, 16 s), capped at 30 s.
- Random jitter on every delay to avoid synchronized reconnect storms.
- After reconnecting, the client re-authenticates in the first message
  (§9), restores each subscription exactly once and resynchronizes (§26).

---

# 28. Reconnection UX

**Status:** `Planned (FE)` (ADR-007 point 12)

| Connection state (§6) | UI |
|---|---|
| `CONNECTED` | No indicator. |
| `CONNECTING`, `RECONNECTING`, `DISCONNECTED` | Subtle, non-blocking stale-data indicator. |
| `FAILED` | Persistent stale-data warning with a manual retry action. |

Connection changes create no notification (§21).

---

# 29. Graceful Degradation

**Status:** `Planned (FE)` (ADR-007 point 12)

While the socket is down the application stays usable: HTTP reads and
writes keep working, the UI shows the stale-data indicator (§28), and data
is refreshed through HTTP (§30). Realtime failure never blocks a screen.

---

# 30. Polling Fallback

**Status:** `Planned (FE)` (ADR-007 points 12 and 15, NFR-014, NFR-017)

```text
CONNECTED              -> realtime updates, no polling
socket down            -> periodic HTTP refetch of visible data
reconnected            -> stop polling, resynchronize once (§26)
```

- Polling never runs alongside an active subscription for the same data.
- While the socket is down, visible data is refetched every 10 seconds
  (ADR-007 point 15).
- Polling requests use the 15 s client timeout (NFR-017).

---

# 31. Selective Updates

**Status:** `Planned (FE)` (ADR-007 point 6, NFR-006)

A market price event updates only what depends on that asset:

```text
MARKET_PRICE_UPDATED
    ↓
Asset price
    ↓
Positions holding the asset
    ↓
Their portfolio metrics (recomputed on the client)
```

Unrelated portfolios and screens do not re-render. A burst of 100 events in
1 s keeps INP ≤ 200 ms and is applied in at most one render per animation
frame (NFR-006).

---

# 32. State Update Strategy

**Status:** `Planned (FE)` (ADR-007 point 6)

| Event | Client action |
|---|---|
| `MARKET_PRICE_UPDATED` | Write the price into cached state; recompute dependent values locally. |
| `PORTFOLIO_UPDATED` | Invalidate and refetch the portfolio through HTTP (§18). |
| `JOB_PROGRESS_UPDATED` | Update the job progress in cached state. |
| `JOB_COMPLETED`, `JOB_FAILED` | Refetch the job through HTTP. |
| `NOTIFICATION_CREATED` | Fetch the notification (§21). |
| `ALERT_TRIGGERED` | Update the alert state; the paired `NOTIFICATION_CREATED` drives the notification fetch (§22). |

Events that carry authoritative data update state directly; events that
only signal a change trigger a refetch. Global invalidation on a price tick
is not allowed.

---

# 33. TanStack Query Integration

**Status:** `Planned (FE)`; library choice `Deferred` (`04-tech-stack.md`)

Library-agnostic server-state cache rules:

- Server data lives in one server-state cache keyed by resource.
- An event with authoritative data writes into the cached entry (direct
  update); an event that only signals a change marks the entry stale and
  refetches it (invalidation), per §32.
- Resynchronization (§26) refetches the affected entries.

No ADR selects TanStack Query; the library is chosen in a frontend-stage
decision.

---

# 34. Zustand Integration

**Status:** `Planned (FE)`; library choice `Deferred` (`04-tech-stack.md`)

Library-agnostic client-state rules:

- Realtime client state (connection state, active subscriptions,
  `lastProcessedSequence` per channel, current epoch) lives in a client
  state store separate from the server-state cache.
- Server data is never duplicated into that store.

No ADR selects Zustand; the library is chosen in a frontend-stage decision.

---

# 35. Market Simulation

**Status:** server simulator `Planned (B5)`; demo adapter `Planned (FE)` (ADR-007 points 7, 8 and 13)

There is no external market data provider. One engine, the pure package
`@trading/market-sim`, produces all prices in both modes:

```text
@trading/market-sim (seeded PRNG, injected clock)
   ├─ real mode: API process -> MarketPrice + MarketEvent -> WebSocket
   └─ demo: browser -> in-process realtime adapter (same client port)
```

- The engine depends only on `@trading/domain`.
- Real mode: each tick updates `MarketPrice` and appends a `MarketEvent`
  (bounded retention defined in B5).
- At every UTC day rollover the simulator closes a daily `HistoricalPrice`
  candle per asset and rolls `MarketPrice.previousPrice` to that close.
- On startup it deterministically generates the candles for the days the
  server was offline, so the daily series has no gaps.

---

# 36. Price Simulation

**Status:** `Planned (B5)` (ADR-007 points 7 and 14, ADR-002)

- Prices come from the seeded generator, never from an unseeded random
  source.
- Prices are emitted as money in the ADR-002 wire format (`amount` is a
  decimal string).
- The simulator does not model real markets; it reproduces application
  behavior (alerts, valuations, charts).
- The price model (trend, volatility, noise) is a B5 implementation detail.

---

# 37. Simulation Profiles

**Status:** `Planned (B5)` (ADR-007 points 7 and 15)

The engine implements the modes and scenarios of `12-demo-mode-spec.md`
§37 and §39:

```text
Modes:     Paused, Normal, Volatile, Bullish, Bearish
Scenarios: Stable Market, Bullish Session, Volatile Session,
           Sharp Drawdown, Recovery
```

This replaces the earlier profile list (`CALM`, `BREAKOUT`, `SELL_OFF` and
others). Wire identifiers are SCREAMING_SNAKE_CASE (ADR-007 point 15):

| Kind | Wire identifiers |
|---|---|
| Modes | `PAUSED`, `NORMAL`, `VOLATILE`, `BULLISH`, `BEARISH` |
| Scenarios | `STABLE_MARKET`, `BULLISH_SESSION`, `VOLATILE_SESSION`, `SHARP_DRAWDOWN`, `RECOVERY` |

`PAUSED` is only a mode wire identifier; the lifecycle state is `HALTED`
(§40, ADR-007 point 16). What the `PAUSED` mode does is an Open detail (B5)
of §40.

---

# 38. Simulation Timing

**Status:** `Planned (B5)` (ADR-007 points 7, 8 and 15)

- Time comes from an injected clock, so tests and the demo can accelerate
  or freeze it (`12-demo-mode-spec.md` §40).
- Daily candles close at the UTC day rollover of that clock.
- The simulator ticks every 1 second (ADR-007 point 15). NFR-006 sets no
  tick interval; its client target (a burst of 100 events within 1 s keeps
  INP ≤ 200 ms) applies at this interval too.

---

# 39. Simulation Determinism

**Status:** `Planned (B5)`; demo `Planned (FE)` (ADR-007 point 7, NFR-045)

```text
seed + mode or scenario + initial state + clock -> same event sequence
```

The same seed produces the same initial state and the same simulated
series (NFR-045). After a server restart the engine resumes from persisted
`MarketPrice` and `MAX(sequence)` per asset, not from the seed state
(ADR-007 Deferred detail, B5).

---

# 40. Simulation Lifecycle

**Status:** `Planned (B5)` (ADR-007 points 8, 10 and 15)

```text
RUNNING <-> HALTED
```

- The server simulator runs with the API process; on startup it backfills
  missing daily candles (§35).
- `ADMIN` can pause it, start it again and change its mode (§41).
- Real mode has no stop and no seed reset, so there is no `STOPPED`,
  `STARTING` or `STOPPING` state. Reset belongs to the frontend-stage demo
  ADR (ADR-010 point 6).

The internal lifecycle state is `HALTED`; `PAUSED` stays only as a mode
wire identifier (§37, ADR-007 point 16). `POST /api/v1/simulation/pause`
moves `RUNNING` to `HALTED` and `start` moves it back.

Open detail (B5): whether `PUT /api/v1/simulation/mode` with `PAUSED` stops
ticking like `pause`, and which mode `start` resumes, are not decided
(ADR-007 Deferred detail).

---

# 41. Demo Simulation Controls

**Status:** real-mode control `Planned (B5)` (ADR-007 points 10 and 15); demo controls `Deferred` (ADR-010 point 6)

Real mode: each endpoint requires the `simulation:control` permission
(`ADMIN` only, ADR-005):

| Operation | Endpoint |
|---|---|
| Start the simulation | `POST /api/v1/simulation/start` |
| Pause the simulation | `POST /api/v1/simulation/pause` |
| Change the simulation mode | `PUT /api/v1/simulation/mode` with `{ "mode": "<wire id>" }` (§37) |

- Errors follow ADR-002 point 10: 400 `VALIDATION_ERROR` for an unknown
  mode; 403 `FORBIDDEN` without `simulation:control`.
- The lifecycle is only `RUNNING <-> HALTED` (§40).

Demo: the simulation panel, reset, speed, simulated disconnect and
simulated errors are decided in the frontend-stage demo ADR (ADR-010
point 6).

Decided in ADR-007 point 15 (2026-10-06):

| Topic | Decision | Section |
|---|---|---|
| Control endpoints | The three endpoints above | §41 |
| Stop, seed reset and `STOPPED` | None in real mode | §40 |
| Tick and polling intervals | Tick every 1 s; HTTP polling every 10 s while the socket is down | §30, §38 |
| Wire identifiers | SCREAMING_SNAKE_CASE modes and scenarios | §37 |

Open detail (B5): the success response bodies, and the response when
`start` or `pause` finds the simulator already in the target state.
`07-api-spec.md` §54 points here.

---

# 42. Simulated Disconnect

**Status:** demo control `Deferred` (ADR-010 point 6, FR-046); disconnect in client tests `Planned (FE)` (NFR-014, NFR-018)

The client must survive this sequence without a page reload:

```text
CONNECTED
    ↓  socket lost (§7)
RECONNECTING        stale-data indicator, HTTP polling (§28, §30)
    ↓  backoff succeeds (§27)
CONNECTED           re-authenticate, resubscribe once, resynchronize (§26)
```

- Client tests drive it with a transport test double that drops the
  socket; this is the "simulated disconnect" of NFR-018.
- A demo control that triggers it on demand is decided in the
  frontend-stage demo ADR (ADR-010 point 6).

---

# 43. Simulated Event Failure

**Status:** test fault injection `Planned (FE)`; demo scripted failures `Deferred` (ADR-010 point 6, NFR-058)

Client tests inject these faults through the transport test double:

| Fault | Expected handling |
|---|---|
| Duplicate event | Discarded (§44) |
| Out-of-order event | Discarded if superseded (§45) |
| Delayed event | Applied only if not superseded (§46) |
| Dropped event | Detected as a gap and resynchronized (§25) |
| Invalid event | Dropped and logged (§23) |

- Faults are injected at the transport port, not in `@trading/market-sim`
  or the API. Failure injection is demo-only or test-only code and never
  reaches the API build (NFR-058).
- Each fault scenario is a fixed event list or a seeded sequence, so it is
  reproducible (NFR-045).

---

# 44. Duplicate Events

**Status:** `Planned (FE)` (ADR-007 point 5, NFR-018)

```text
101  applied
102  applied
102  discarded (102 <= 102)
103  applied
```

Every server event carries a `sequence` (§14), so the §24 rule always
applies; a duplicate never updates state twice.

---

# 45. Out-of-Order Events

**Status:** `Planned (FE)` (ADR-007 point 5, NFR-018)

```text
101  applied
103  applied; gap (102 missing) -> resynchronize (§25, §26)
102  discarded (102 <= 103)
104  applied
```

- `102` never overwrites state produced after `103`.
- The client does not hold events waiting for a missing one; a gap is
  resolved by HTTP resynchronization, since there is no replay buffer
  (ADR-007 point 5).

---

# 46. Delayed Events

**Status:** `Planned (FE)` (ADR-007 point 5 and Deferred detail)

A late event is judged only by its `sequence` against
`lastProcessedSequence` for its channel (§24):

- not superseded (`sequence` greater): applied;
- superseded: discarded, however recent its `timestamp`.

`timestamp` is informational on the client and never decides ordering.
After an epoch change (§14) the baseline is reset by resynchronization
(§26), so sequences from before a server restart are not compared with the
new ones.

Open detail (B5): handling of an event carrying the previous epoch that
arrives after the client has adopted the new one (expected: discarded).

---

# 47. Event Deduplication

**Status:** `Planned (FE)` (ADR-007 points 4 and 5, NFR-018)

Deduplication uses `sequence` per channel (§24). Version 1 has no server
replay and no transport-level redelivery, so a second, ID-based
deduplication set is not required. The envelope `id` identifies an event
in logs and diagnostics (§58).

Open detail (B5): scope of `id` uniqueness (global or per channel) and its
format, defined with the envelope schema in `@trading/contracts`.

---

# 48. Event Backpressure

**Status:** client `Planned (FE)` (NFR-006); server limits `Planned (B5)` (ADR-007 point 11)

Client:

- Every valid event updates state in order; only rendering is coalesced
  (§49), so state stays consistent with the last processed `sequence`.
- Several price events for one asset within a frame collapse to the latest
  price for display.
- A burst of 100 events in 1 s keeps INP ≤ 200 ms (NFR-006).

Server: the subscription limit, inbound rate limit and bounded memory per
connection of §7 apply: 50 subscriptions, 20 inbound messages per second
and a 1 MB outbound buffer (ADR-007 point 15).

Open detail (B5): behavior when a slow client's outbound buffer reaches
1 MB (drop messages, or close the socket with `4008`, §9). Either choice
ends in a client resynchronization (§26).

---

# 49. Rendering Frequency

**Status:** `Planned (FE)` (NFR-004, NFR-005, NFR-006, NFR-032)

Event processing and rendering run at different rates:

```text
Incoming events  -> processed one by one into state
Rendering        -> at most one render per animation frame
```

- A price update is visible within 100 ms of the client receiving it
  (NFR-004).
- Only components that display the affected asset, or a value derived from
  it, re-render (NFR-005).
- Intermediate ticks may be skipped on screen; the latest value is always
  shown.
- Update highlights follow `11-ui-ux-spec.md` §15 and are disabled under
  reduced motion (NFR-032).
- The simulator ticks every 1 second (§38).

---

# 50. Chart Realtime Updates

**Status:** `Planned (FE)` (NFR-005, NFR-006, FR-045); chart library `Deferred` (`04-tech-stack.md` §16)

- A chart redraws only when an asset it plots changes (NFR-005), at most
  once per animation frame (NFR-006).
- Period analytics charts (FR-025 to FR-031) cover closed days only; they
  change when a daily candle closes, not on ticks (FR-045).
- A chart that plots ticks keeps them in a bounded window (§51).
- The rendering technique (canvas or SVG) depends on the chart library and
  is decided with it.

---

# 51. Memory Management

**Status:** client `Planned (FE)`; server per-connection bound `Planned (B5)` (ADR-007 point 11)

Client:

- No event history is kept: per channel only the derived state, the
  `lastProcessedSequence` and the current epoch.
- The buffer used while resynchronizing (§26) is bounded.
- Tick-level chart data uses a bounded window (§50).
- Unsubscribing a channel (§52) discards its buffer and sequence state.

Server: memory per connection is bounded (§7, §48).

Open detail (FE): size of the resynchronization buffer and the behavior
when it overflows (expected: discard it and resynchronize again).

---

# 52. Subscription Lifecycle

**Status:** client `Planned (FE)`; server subscription handling `Planned (B5)` (ADR-007 points 3 and 11, FR-086)

| Channel | Subscribed while |
|---|---|
| `notifications` | The session is authenticated |
| `portfolio:{portfolioId}` | A view shows that portfolio |
| `market:{assetId}` | A view shows that asset's price |
| `jobs:{jobId}` | A view follows that import, until its final event |

```text
Open portfolio  -> SUBSCRIBE portfolio:{portfolioId}
Show asset      -> SUBSCRIBE market:{assetId}
Leave asset     -> UNSUBSCRIBE market:{assetId}
```

- Unused subscriptions do not stay active.
- On socket close the server drops all of that connection's
  subscriptions; the client restores the needed ones after reconnecting
  (§27).
- Re-authentication can drop subscriptions the actor may no longer hold
  (§9).
- The subscription limit is 50 per connection (§7); the client keeps its
  active set below it.

---

# 53. Multiple Subscribers

**Status:** `Planned (FE)` (ADR-007 point 11, NFR-054)

```text
Component A ─┐
Component B ─┼→ one subscription per channel → one connection
Component C ─┘
```

- The realtime client counts consumers per channel: the first one sends
  `SUBSCRIBE`, the last one to leave sends `UNSUBSCRIBE`.
- Each client holds at most one realtime connection (NFR-054).

Open detail (B5): server handling of a repeated `SUBSCRIBE` to a channel the
connection already holds (`ACK` or `ERROR`, §9).

---

# 54. Realtime and Authentication Changes

**Status:** client `Planned (FE)`; server rules `Planned (B5)` (ADR-007 point 2 and Deferred detail, ADR-005 points 6 and 9)

| Event | Client | Server |
|---|---|---|
| Token refresh | Re-authenticate over the same socket (§9). | Extends the socket bound; reloads role and ownership. |
| Role change | — | Applied at the next re-authentication (ADR-005 point 9). |
| Refresh fails | Close the socket; clear realtime state. | Closes the socket when the token expires. |
| Logout | Close the socket; clear realtime state and cached server data. | — |
| Login as another user | Open a new socket. | Rejects re-authentication when `sub` changes and closes the socket. |

- An intentional close goes to `DISCONNECTED` and does not trigger
  reconnection.
- Logout revokes the session, but the access token stays valid until it
  expires (ADR-005 point 6); the client closing the socket is what ends
  delivery at logout.
- Data from a previous session never leaks into the next one.

A `4002` close means the token expired, so the client refreshes and
reconnects; a `1001` close, or a socket lost without a close code, is a
network loss and goes to `RECONNECTING` (§7).

---

# 55. Security Requirements

**Status:** `Planned (B5)` (ADR-007 points 2, 3 and 11, ADR-005 points 3 and 12, FR-086, NFR-020, NFR-026)

| Requirement | Section |
|---|---|
| Token in the first message, never in the URL; 5 s authentication limit | §9 |
| Socket bound to token expiry; re-authentication reloads permissions | §9 |
| Every subscription authorized in the application layer by permission and ownership | §10 |
| Subscription limit, inbound rate limit, bounded memory, heartbeat | §7 |
| Server events validated against `@trading/contracts` schemas | §14 |
| Tokens never logged | §58 |

- The client is never trusted to enforce authorization (NFR-026); client
  validation (§23) protects state, not access.
- A refused subscription to another user's channel is indistinguishable
  from an unknown channel, so existence is not revealed (ADR-005
  point 12).
- `market:{assetId}`, the only channel open to any authenticated actor,
  carries only simulated prices.
- `09-security-spec.md` §31-35 covers the same rules from the security
  view.

---

# 56. Demo Security

**Status:** `Planned (FE)` (ADR-005 points 3 and 11, ADR-007 point 13, NFR-026)

```text
Demo identity (role selector) -> Actor -> application-layer checks -> subscription
```

- The demo uses a controlled identity with a role selector (ADR-005
  point 11); there is no token handshake in the in-process adapter.
- Subscription authorization is an application-layer use case (§10), so
  the demo composition root runs the same check as the API (ADR-005
  point 3).
- This is behavior parity, not security: the demo runs without a server
  (NFR-026 accepted exception).

---

# 57. Realtime Error Handling

**Status:** `Planned (FE)`; wire messages and close codes `Planned (B5)` (ADR-007 point 15)

The realtime client maps transport and protocol errors to one normalized
error, so feature modules never handle WebSocket objects (ADR-007 point 1):

```text
RealtimeError {
  type        // a category below
  recoverable // true -> reconnect with backoff (§27)
}
```

| Category | Source rule | Client reaction |
|---|---|---|
| Connection lost or failed | §7, §27 | Reconnect; `FAILED` after retries |
| Authentication refused or expired | §9 | Refresh the token, then reconnect; otherwise end the session |
| Subscription refused | §10, §52 | Drop the consumer's subscription; show no data for it |
| Limit exceeded | §7 | Report as non-recoverable for that request |
| Invalid event | §23 | Drop and log; never shown to the user |

- Category and field names are client-side and not part of the wire
  contract. The wire carries `ERROR` replies with a `code` and the close
  codes of §9 (`4001`, `4002` and `4008` map to the authentication and
  limit categories). The `ERROR` code set is an Open detail (B5), §9.
- Realtime errors show the stale-data indicator (§28), not an error page
  (NFR-013).

---

# 58. Observability

**Status:** server logging `Planned (B5)` on the B3 `Logger` port (ADR-009 points 3-5, 9 and 11); client diagnostics `Planned (FE)`; metrics `Deferred` (ADR-009 point 10)

Server:

- Connection lifecycle events (connect, authenticate, close) are logged as
  JSON lines with stable dotted `event` names (ADR-009 points 3 and 11).
- Each entry carries `connectionId` and, once authenticated, `userId`
  (ADR-009 point 5).
- A refused subscription is logged as `authz.denied` (ADR-009 point 9).
- Access tokens from `AUTHENTICATE` messages and event payloads with user
  data are never logged (ADR-009 point 4).

Client diagnostics, exposed through the realtime client:

```text
connection state
reconnect attempts
last processed sequence and epoch per channel
active subscriptions
dropped (invalid) event count
```

The demo writes through the browser-console `Logger` adapter (ADR-009
point 1).

Open detail (B5): the level for per-event entries, so continuous ticks do
not flood `info` logs, and the final event names, aligned with
`13-observability-spec.md`.

---

# 59. Testing Requirements

**Status:** server `Planned (B5)`; client `Planned (FE)` (NFR-004, NFR-005, NFR-006, NFR-018, NFR-045)

Tests use the injected clock and seeded engine, never wall time or
unseeded randomness.

### Server connection and authorization (B5)

- Unauthenticated socket closed after 5 s; token accepted only in the
  first message (§9).
- Socket closed when the token expires without re-authentication;
  re-authentication extends the bound (§9).
- Re-authentication with another `sub` closes the socket; a role change
  drops subscriptions no longer allowed (§9).
- Subscribing to another user's `portfolio:{portfolioId}` or `jobs:{jobId}`
  is refused like an unknown channel (§10, §55).
- Heartbeat every 30 s and close after 2 missed pongs; 50 subscriptions
  and 20 inbound messages per second enforced (§7).

### Server events (B5)

- Every event matches its `@trading/contracts` schema; money is a decimal
  string (§14, §16).
- `sequence` is monotonic per channel; the epoch changes after a restart
  (§14).
- `PORTFOLIO_UPDATED` only after a transaction commits, never on ticks
  (§18).
- Job events on `jobs:{jobId}` match the job state (§20).
- Alerts are edge-triggered and each trigger emits `ALERT_TRIGGERED` and
  `NOTIFICATION_CREATED` (§22).

### Simulation (B5)

- Same seed, mode and clock produce the same event sequence (§39,
  NFR-045).
- The UTC rollover closes one daily candle per asset and rolls
  `previousPrice`; startup backfills offline days (§35).
- After a restart the engine resumes from persisted `MarketPrice` and
  `MAX(sequence)` (§39).
- Start, pause and mode change require `simulation:control` (§41).
- The simulator ticks every 1 second on the injected clock (§38).

### Client (FE)

- Connection states and transitions (§6, §7); manual retry from `FAILED`.
- Backoff 1 s doubling to a 30 s cap, with jitter (§27, NFR-018).
- Each subscription restored exactly once after reconnecting (§27).
- Invalid events dropped (§23); duplicate, stale and out-of-order events
  discarded (§44-§46).
- Resynchronization on a gap, a reconnect and an epoch change (§26).
- Polling every 10 s only while the socket is down; stops on reconnect
  (§30).
- Render counting: one price event renders only affected components
  (§31, NFR-005).
- Burst of 100 events in 1 s: INP ≤ 200 ms, one render per frame (§48,
  NFR-006); visible update within 100 ms (§49, NFR-004).
- Shared subscriptions and cleanup on unsubscribe (§52, §53).
- Logout closes the socket and clears realtime state (§54).
- Disconnect and fault scenarios through the transport test double (§42,
  §43).

---

# 60. Realtime Acceptance Criteria

**Status:** server `Planned (B5)`; client `Planned (FE)`

The realtime layer is complete when every §59 test passes and:

- [ ] `ws` is used only inside the transport adapter; no other module
      imports it (§2, §5).
- [ ] Real and demo transports satisfy the same client port and event
      contract (§5, ADR-007 point 13).
- [ ] Only the version 1 event catalog is emitted (§15).
- [ ] Every event is validated before it reaches state (§23).
- [ ] Duplicate, stale and out-of-order events never overwrite newer state
      (§44-§46).
- [ ] Gaps, reconnects and epoch changes resynchronize through HTTP (§26).
- [ ] Connection state is explicit and shown as in §28.
- [ ] With the socket down, the application stays usable through HTTP
      (§29, NFR-014).
- [ ] Subscriptions are authorized on the server and cleaned up on the
      client (§10, §52).
- [ ] Bursts meet NFR-006 and updates meet NFR-004 and NFR-005.
- [ ] No demo or failure-injection module is in the API build (§43,
      NFR-058).

Demo failure scenarios (§42, §43) join these criteria once the
frontend-stage demo ADR decides them (ADR-010 point 6).

---

# 61. Final Realtime Architecture

**Status:** `Reference` (ADR-007, ADR-001)

Server (B5):

```text
Use case commits (application layer, ADR-001)
        ↓
Realtime emitter port (in process, after commit)
        ↓
Subscription authorization (permission + ownership)
        ↓
ws transport adapter  ← @trading/market-sim (API process)
        ↓
WebSocket
```

Client (FE):

```text
WebSocket transport (real)  |  In-process adapter + @trading/market-sim (demo)
                      ↓
           Realtime client port
                      ↓
     Validation (@trading/contracts schemas)
                      ↓
     Sequence and epoch check per channel
                      ↓
   ┌──────────────────┴──────────────────┐
   ▼                                     ▼
Server-state cache                 Client-state store
(update or refetch, §32)           (connection, subscriptions)
   └──────────────────┬──────────────────┘
                      ▼
                     UI
```

- Both transports converge into the same client pipeline (ADR-007
  point 13).
- Cache and store libraries are not decided (§33, §34).
- HTTP remains the authoritative source for every resynchronization.

---

# 62. Architectural Principle

**Status:** `Reference`

The realtime layer is not there to make the dashboard look live. It
addresses a real engineering problem:

> How can a high-frequency event stream update only the state that matters, remain consistent when events arrive late or out of order, recover from connection failures, and degrade gracefully when realtime infrastructure is unavailable?

That behavior is part of the product.
