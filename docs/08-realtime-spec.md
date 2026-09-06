# Trading Analytics Platform

## SDD — 07. Realtime Specification

**Status:** Draft  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`, `05-data-model.md`, `06-architecture.md`, `07-api-spec.md`

---

# 1. Purpose

This document defines the real-time communication architecture for Trading Analytics Platform.

Realtime functionality is a core product capability.

The system must support:

- live market price updates;
- portfolio metric updates;
- background job progress;
- notifications;
- connection state;
- reconnection;
- event ordering;
- stale-event protection;
- selective state updates;
- simulated realtime behavior in Demo Mode.

The public demo must reproduce these behaviors without requiring an external realtime provider.

---

# 2. Realtime Technology

The production implementation will use:

```text
WebSockets
```

The frontend communicates with the realtime layer through a dedicated adapter.

The UI must never depend directly on the WebSocket implementation.

Architecture:

```text
UI
 ↓
Realtime Client
 ↓
Realtime Adapter
 ↓
WebSocket Transport
```

---

# 3. Realtime Principles

The realtime system must follow these principles:

1. Transport is infrastructure.
2. Events use application-defined contracts.
3. Raw WebSocket messages must never leak into feature modules.
4. Events must be validated before entering application state.
5. Events must be ordered where ordering information exists.
6. Stale events must not overwrite newer state.
7. Reconnection must be automatic.
8. Realtime failure must degrade gracefully.
9. Unrelated UI must not re-render.
10. Demo Mode must reproduce the same event contract.

---

# 4. Realtime Architecture

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

The application must depend on a transport-independent interface.

Conceptually:

```text
RealtimeTransport
```

The interface should support:

```text
connect()
disconnect()
subscribe()
unsubscribe()
send()
getConnectionState()
```

The concrete implementation may be:

```text
WebSocketRealtimeTransport
```

Demo Mode may use:

```text
MockRealtimeTransport
```

Both must satisfy the same contract.

---

# 6. Connection States

The realtime client exposes the following states:

```text
DISCONNECTED
CONNECTING
CONNECTED
RECONNECTING
FAILED
```

Optional transient states may be introduced if implementation requires them.

---

# 7. Connection Lifecycle

Normal lifecycle:

```text
DISCONNECTED
      ↓
CONNECTING
      ↓
CONNECTED
```

Connection failure:

```text
CONNECTING
      ↓
RECONNECTING
      ↓
CONNECTED
```

Persistent failure:

```text
RECONNECTING
      ↓
FAILED
```

Manual retry:

```text
FAILED
      ↓
CONNECTING
```

---

# 8. Initial Connection

When an authenticated session starts:

```text
Application Bootstrap
        ↓
Initialize Realtime Client
        ↓
Connect
        ↓
Authenticate Connection
        ↓
Subscribe Required Channels
```

The application must not assume the connection is immediately available.

---

# 9. Authentication

The realtime connection must be associated with the authenticated user.

The exact authentication mechanism will be defined by the backend implementation.

The realtime layer must not duplicate authentication logic already handled by the application.

---

# 10. Channel Model

The system should use logical channels rather than exposing infrastructure-specific subscriptions to features.

Examples:

```text
user:{userId}
portfolio:{portfolioId}
market:{assetId}
jobs:{jobId}
notifications:{userId}
```

Feature modules request subscriptions through the realtime client.

---

# 11. Market Data Channel

Market updates are grouped by asset or market subscription.

Example:

```text
market:asset_001
```

The client subscribes only to assets currently required by the application.

The system should avoid subscribing to every available asset by default.

---

# 12. Portfolio Channel

A portfolio-specific channel may publish events relevant to:

- positions;
- portfolio metrics;
- transaction processing;
- analytics;
- alerts.

Example:

```text
portfolio:portfolio_001
```

---

# 13. Job Channel

Long-running operations can expose a dedicated job channel.

Example:

```text
jobs:job_001
```

This allows the UI to receive progress updates without polling continuously.

---

# 14. Event Envelope

All application realtime events use a normalized envelope.

```text
{
  "id": "event_001",
  "type": "MARKET_PRICE_UPDATED",
  "timestamp": "2026-08-29T14:30:00Z",
  "sequence": 1024,
  "payload": {}
}
```

Required properties:

```text
id
type
timestamp
payload
```

`sequence` is required for event streams where ordering is relevant.

---

# 15. Event Types

Initial event catalog:

```text
MARKET_PRICE_UPDATED
PORTFOLIO_UPDATED
POSITION_UPDATED
TRANSACTION_CREATED
TRANSACTION_COMPLETED
JOB_CREATED
JOB_PROGRESS_UPDATED
JOB_COMPLETED
JOB_FAILED
NOTIFICATION_CREATED
ALERT_TRIGGERED
```

Additional events may be introduced when justified by product requirements.

---

# 16. Market Price Event

Example:

```text
{
  "id": "event_001",
  "type": "MARKET_PRICE_UPDATED",
  "timestamp": "...",
  "sequence": 1201,
  "payload": {
    "assetId": "asset_001",
    "price": 184.22,
    "previousPrice": 183.90,
    "change": 0.32,
    "changePercent": 0.17
  }
}
```

---

# 17. Position Update Event

```text
{
  "type": "POSITION_UPDATED",
  "payload": {
    "portfolioId": "portfolio_001",
    "positionId": "position_001",
    "reason": "MARKET_PRICE_UPDATED"
  }
}
```

The event may contain only the identifiers and reason.

The client should not receive unnecessarily large payloads.

---

# 18. Portfolio Update Event

```text
{
  "type": "PORTFOLIO_UPDATED",
  "payload": {
    "portfolioId": "portfolio_001",
    "reason": "POSITION_UPDATED"
  }
}
```

The application decides whether to:

- update cached data;
- invalidate a query;
- calculate a derived value;
- fetch additional information.

---

# 19. Transaction Events

Transaction lifecycle:

```text
CREATED
   ↓
PROCESSING
   ↓
COMPLETED
```

Failure:

```text
PROCESSING
   ↓
FAILED
```

Relevant events:

```text
TRANSACTION_CREATED
TRANSACTION_COMPLETED
```

---

# 20. Background Job Events

A job may emit:

```text
JOB_CREATED
JOB_PROGRESS_UPDATED
JOB_COMPLETED
JOB_FAILED
```

Example:

```text
{
  "type": "JOB_PROGRESS_UPDATED",
  "payload": {
    "jobId": "job_001",
    "status": "PROCESSING",
    "progress": 75,
    "message": "Updating analytics."
  }
}
```

---

# 21. Notification Events

New notifications may be pushed through:

```text
NOTIFICATION_CREATED
```

Example:

```text
{
  "type": "NOTIFICATION_CREATED",
  "payload": {
    "notificationId": "notification_001"
  }
}
```

The client may then retrieve the complete notification through the HTTP API.

---

# 22. Alert Events

When a configured alert condition is satisfied:

```text
ALERT_TRIGGERED
```

Example:

```text
{
  "type": "ALERT_TRIGGERED",
  "payload": {
    "alertId": "alert_001",
    "assetId": "asset_001",
    "triggerValue": 200,
    "condition": "ABOVE"
  }
}
```

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
