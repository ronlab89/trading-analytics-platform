# SDD 08 — Realtime Specification

**Project:** Trading Analytics Platform  
**Status:** Draft  
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
so no other code depends on it. Socket.IO and Server-Sent Events are
rejected (ADR-007, Alternatives Considered).

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

**Status:** client transitions `Planned (FE)`; heartbeat and limits `Planned (B5)` (ADR-007 points 2 and 11)

Client transitions:

```text
DISCONNECTED → CONNECTING → CONNECTED
CONNECTING   → RECONNECTING → CONNECTED
RECONNECTING → FAILED
FAILED       → CONNECTING        (manual retry)
```

Server rules:

- Heartbeat: WebSocket ping/pong every 30 seconds.
- Limits: a maximum number of subscriptions per connection, an inbound
  message rate limit, and bounded memory per connection. The numeric values
  and the missed-pong policy are decided in B5.
- The server closes a socket not authenticated within 5 seconds, or whose
  token expired without re-authentication (§9).

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

**Status:** `Planned (B5)` (ADR-007 point 2, ADR-005)

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

Client message names, acknowledgements, error messages and close codes are
decided in B5, as Zod schemas in `@trading/contracts`.

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

**Status:** `Planned (B5)` (ADR-007 point 6, ADR-008 point 11)

Catalog, version 1:

| Type | Channel |
|---|---|
| `MARKET_PRICE_UPDATED` | `market:{assetId}` |
| `PORTFOLIO_UPDATED` | `portfolio:{portfolioId}` |
| `JOB_PROGRESS_UPDATED` | `jobs:{jobId}` |
| `JOB_COMPLETED` | `jobs:{jobId}` |
| `JOB_FAILED` | `jobs:{jobId}` |
| `NOTIFICATION_CREATED` | `notifications` |
| `ALERT_TRIGGERED` | `notifications` (open decision 1, §22) |

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
    "price": "184.22",
    "previousPrice": "182.10",
    "change": "2.12",
    "changePercent": "1.16",
    "tickChange": "0.32"
  }
}
```

- All numeric payload fields are decimal strings.
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

**Status:** `Planned (B5)` (ADR-008 points 3, 6 and 11)

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
  `APPLY_REJECTED`.
- `CANCELLED` and `TIMED_OUT` have no event yet (open decision 2, §22).

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

**Status:** `Planned (B5)` (ADR-007 point 9)

```json
{
  "type": "ALERT_TRIGGERED",
  "channel": "notifications",
  "payload": {
    "alertId": "alert_001",
    "assetId": "asset_001",
    "condition": "ABOVE",
    "threshold": "200.00",
    "price": "200.15"
  }
}
```

- Edge-triggered: fires when the condition changes from false to true, and
  re-arms when it becomes false again; never on every tick (FR-053).
- Each trigger also creates a `WARNING` notification and emits
  `NOTIFICATION_CREATED`.
- `threshold` and `price` are decimal strings.

Open decisions for B5 (none changes ADR-007):

1. The channel of `ALERT_TRIGGERED`. `notifications` is assumed because
   alerts are user-scoped and ADR-007 point 3 names no alert channel.
2. Whether `CANCELLED` and `TIMED_OUT` jobs emit a realtime event; ADR-008
   point 11 lists only three job events.
3. Client message names (`AUTHENTICATE`, `SUBSCRIBE`, `UNSUBSCRIBE`),
   acknowledgements, errors and close codes.
4. Numeric limits and the missed-pong policy of §7.

---

# 23. Event Validation

Every incoming event must be validated before entering application state.

Validation includes:

- event type;
- envelope structure;
- payload structure;
- required identifiers;
- timestamp;
- sequence where applicable.

Invalid events must be rejected safely.

---

# 24. Event Ordering

For ordered streams, the client maintains:

```text
lastProcessedSequence
```

Incoming event:

```text
incomingSequence
```

Processing rule:

```text
incomingSequence > lastProcessedSequence
```

If:

```text
incomingSequence <= lastProcessedSequence
```

the event is considered stale and must not overwrite current state.

---

# 25. Event Gaps

If the client receives:

```text
sequence 101
sequence 102
sequence 105
```

then events `103` and `104` may be missing.

The client should detect the gap.

Depending on the stream:

```text
Event Gap
   ↓
Request State Resynchronization
```

The exact recovery strategy may use HTTP state refresh.

---

# 26. State Resynchronization

When realtime state may be inconsistent:

```text
Realtime Event
      ↓
Consistency Check
      ↓
Gap / Invalid State
      ↓
HTTP Refetch
      ↓
Authoritative State
```

HTTP APIs remain the authoritative recovery mechanism.

---

# 27. Reconnection Strategy

Reconnection should use exponential backoff.

Conceptually:

```text
1s
2s
4s
8s
16s
...
```

A maximum retry delay must be enforced.

Random jitter should be introduced to prevent synchronized reconnect storms.

---

# 28. Reconnection UX

The application should communicate connection state without unnecessarily interrupting the user.

Examples:

```text
CONNECTED
```

Normal state.

```text
RECONNECTING
```

Subtle non-blocking indicator.

```text
FAILED
```

Persistent warning with manual retry.

---

# 29. Graceful Degradation

If realtime becomes unavailable:

The application should continue functioning wherever possible.

For example:

```text
Realtime unavailable
       ↓
Connection warning
       ↓
Fallback to HTTP refresh
```

Realtime failure must not make the entire platform unusable.

---

# 30. Polling Fallback

Polling may be used as a fallback for data where realtime is unavailable.

It must not run simultaneously with an active realtime subscription unless explicitly required.

Example:

```text
CONNECTED
    ↓
Realtime updates

DISCONNECTED
    ↓
Controlled polling

RECONNECTED
    ↓
Stop polling
```

---

# 31. Selective Updates

A market price event must not trigger a complete application render.

Example:

```text
Price Event
    ↓
Asset State
    ↓
Affected Position
    ↓
Affected Portfolio
```

Unrelated portfolios and screens remain untouched.

---

# 32. State Update Strategy

Realtime updates should prefer targeted state updates over global invalidation.

Bad:

```text
MARKET_PRICE_UPDATED
      ↓
Invalidate Everything
```

Preferred:

```text
MARKET_PRICE_UPDATED
      ↓
Update Asset
      ↓
Update Affected Position
      ↓
Update Relevant Portfolio Metrics
```

Full refetch should be used when local reconciliation becomes more complex than retrieving authoritative state.

---

# 33. TanStack Query Integration

Server state updated through realtime events should integrate with TanStack Query.

Possible strategies:

```text
Event
 ↓
queryClient.setQueryData()
```

or:

```text
Event
 ↓
queryClient.invalidateQueries()
```

The strategy should depend on whether the event contains enough authoritative data.

---

# 34. Zustand Integration

Zustand should primarily handle realtime-related client state such as:

```text
connectionState
activeSubscriptions
simulationState
replayState
```

Domain server data should not automatically be duplicated in Zustand.

---

# 35. Market Simulation

Demo Mode requires a realtime simulation engine.

The simulator generates controlled market events without external APIs.

Architecture:

```text
Simulation Engine
       ↓
Price Generator
       ↓
Event Scheduler
       ↓
Mock Realtime Transport
       ↓
Same Event Pipeline
       ↓
Application
```

---

# 36. Price Simulation

The simulator should produce realistic-looking but deterministic-enough price movements.

It must avoid purely random values that cause visually meaningless behavior.

The simulation may incorporate:

- trend;
- volatility;
- momentum;
- noise;
- event spikes.

The simulator is not intended to model real markets accurately.

Its purpose is to reproduce application behavior.

---

# 37. Simulation Profiles

The simulator should support configurable behavior.

Potential profiles:

```text
CALM
NORMAL
VOLATILE
BREAKOUT
SELL_OFF
RECOVERY
```

Profiles allow different product states to be demonstrated.

---

# 38. Simulation Timing

The simulator should allow configurable update frequency.

Example:

```text
FAST
NORMAL
SLOW
PAUSED
```

The default demo should prioritize visual clarity and browser performance over maximum event frequency.

---

# 39. Simulation Determinism

The simulation engine should support a seed.

Conceptually:

```text
simulationSeed
+
simulationProfile
+
initialState
```

produce a reproducible event sequence.

This is important for:

- testing;
- bug reproduction;
- interviews;
- deterministic demos.

---

# 40. Simulation Lifecycle

```text
STOPPED
   ↓
STARTING
   ↓
RUNNING
   ↓
PAUSED
   ↓
RUNNING
   ↓
STOPPING
   ↓
STOPPED
```

---

# 41. Demo Simulation Controls

The demo may expose a dedicated simulation panel.

Controls may include:

```text
Start
Pause
Resume
Reset
Speed
Market Profile
Simulate Disconnect
Simulate Error
```

These controls should be visually separated from normal product functionality.

---

# 42. Simulated Disconnect

The demo must be able to reproduce:

```text
CONNECTED
    ↓
DISCONNECTED
    ↓
RECONNECTING
    ↓
CONNECTED
```

This demonstrates that the realtime UX is not merely decorative.

---

# 43. Simulated Event Failure

The simulator may intentionally produce:

- delayed events;
- duplicated events;
- out-of-order events;
- dropped events.

These scenarios are useful for validating event handling.

They should be controllable and reproducible.

---

# 44. Duplicate Events

Example:

```text
101
102
102
103
```

The second `102` must be ignored when sequence ordering applies.

---

# 45. Out-of-Order Events

Example:

```text
101
103
102
104
```

Event `102` must not overwrite state after `103` has already been processed.

---

# 46. Delayed Events

An event may arrive significantly later than expected.

The client should determine whether the event is still valid based on:

- sequence;
- timestamp;
- current state.

It must not blindly apply delayed data.

---

# 47. Event Deduplication

Event IDs should be used as an additional deduplication mechanism.

The client may maintain a bounded set of recently processed event IDs.

This prevents duplicate processing when transport retries occur.

---

# 48. Event Backpressure

High-frequency market updates must not overwhelm the browser.

The client may:

- batch updates;
- throttle visual updates;
- coalesce intermediate values;
- update charts at controlled intervals.

The underlying state should remain consistent.

---

# 49. Rendering Frequency

Realtime data frequency and visual rendering frequency do not have to be identical.

Example:

```text
Incoming Events
20 / second

UI Render
10 / second
```

Intermediate values may be coalesced when the product does not require displaying every single tick.

---

# 50. Chart Realtime Updates

Charts must use an optimized update strategy.

The chart layer should not cause the entire dashboard to rerender.

Conceptually:

```text
Market Event
     ↓
Chart Data Buffer
     ↓
Controlled Update
     ↓
Canvas Rendering
```

The implementation should favor canvas-based rendering for high-frequency visualization.

---

# 51. Memory Management

The realtime client must avoid unbounded in-memory event history.

Strategies may include:

- bounded buffers;
- event expiration;
- chart window limits;
- cleanup on unsubscribe.

---

# 52. Subscription Lifecycle

Subscriptions must be created and destroyed according to component/application needs.

Example:

```text
Open Portfolio
      ↓
Subscribe Portfolio
      ↓
View Asset
      ↓
Subscribe Asset
      ↓
Leave Asset
      ↓
Unsubscribe Asset
```

Unused subscriptions must not remain active.

---

# 53. Multiple Subscribers

Multiple UI consumers may subscribe to the same logical event stream.

The realtime infrastructure should maintain a shared subscription rather than creating unnecessary duplicate WebSocket subscriptions.

Conceptually:

```text
Component A ─┐
Component B ─┼→ Shared Subscription
Component C ─┘
```

---

# 54. Realtime and Authentication Changes

When the authenticated user changes:

```text
Logout
 ↓
Close User Channels
 ↓
Clear Realtime State
```

New session:

```text
Login
 ↓
Initialize Connection
 ↓
Subscribe New User Channels
```

Data from a previous session must not leak into the next session.

---

# 55. Security Requirements

The realtime layer must enforce:

- authenticated connections;
- authorized channel subscriptions;
- server-side ownership checks;
- validated event payloads;
- no sensitive information in public events.

The client must never be trusted to enforce authorization.

---

# 56. Demo Security

Demo Mode may bypass real authentication infrastructure, but the application architecture must still preserve the concept of:

```text
User
 ↓
Session
 ↓
Authorization
 ↓
Subscription
```

This keeps the demo representative of the production architecture.

---

# 57. Realtime Error Handling

Transport errors should be normalized.

Example:

```text
WEBSOCKET_CONNECTION_ERROR
```

becomes:

```text
RealtimeError {
  type: CONNECTION_ERROR
  recoverable: true
}
```

Feature modules should not need to understand WebSocket-specific error objects.

---

# 58. Observability

Realtime infrastructure should expose useful diagnostic information:

```text
connection state
reconnect attempts
last received event
last processed sequence
active subscriptions
event processing errors
```

Production logs must avoid sensitive payloads.

---

# 59. Testing Requirements

Realtime functionality must be tested for:

### Connection

- successful connection;
- connection failure;
- reconnection;
- permanent failure;
- manual retry.

### Events

- valid events;
- invalid events;
- duplicate events;
- stale events;
- out-of-order events;
- missing sequence ranges.

### State

- targeted updates;
- cache synchronization;
- state resynchronization.

### Simulation

- deterministic seed;
- simulation profiles;
- pause/resume;
- disconnect;
- event failures.

---

# 60. Realtime Acceptance Criteria

The realtime architecture is considered complete when:

- WebSockets are isolated behind an adapter;
- normalized events are used;
- event payloads are validated;
- stale events are ignored;
- duplicate events are handled;
- connection state is explicit;
- reconnection works;
- realtime failure degrades gracefully;
- subscriptions are cleaned up;
- high-frequency events do not cause uncontrolled rendering;
- charts update efficiently;
- mock realtime implements the same event contract;
- simulation can reproduce failure scenarios;
- demo behavior is deterministic enough for demonstrations.

---

# 61. Final Realtime Architecture

```text
                         ┌──────────────────┐
                         │   React Client   │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │ Realtime Client  │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │ Event Validator  │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │ Event Processor  │
                         └────────┬─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
              Server State                 Client State
             TanStack Query                  Zustand
                    │                           │
                    └─────────────┬─────────────┘
                                  ▼
                                  UI
```

Production:

```text
WebSocket Transport
        ↓
Realtime Adapter
        ↓
Normalized Events
```

Demo:

```text
Simulation Engine
        ↓
Mock Realtime Transport
        ↓
Normalized Events
```

Both converge into the **same realtime application pipeline**.

---

# 62. Architectural Principle

The realtime system must not exist merely to make the dashboard appear “live”.

It exists to demonstrate a realistic engineering problem:

> How can a high-frequency event stream update only the state that matters, remain consistent when events arrive late or out of order, recover from connection failures, and degrade gracefully when realtime infrastructure is unavailable?

That behavior is part of the product itself.
