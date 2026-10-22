# B5.3 Channels, subscriptions and delivery

Source: roadmap B5; ADR-007 points 3, 5, 11 and 17; `08-realtime-spec.md` §10 to §13, §24, §31, §48, §52, §53, §54. Depends on: B5.2. Branch: `feat/b5-3-channels-and-subscriptions`.

Working rules: tiny tasks, each approved by the user before any edit (or delegated for the whole slice); no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/application/src/**
apps/api/src/realtime/**
apps/api/src/composition.ts
odd/tasks/b5/**

## Specs

- S1 A channel authorizer in `@trading/application` decides a subscription by permission and ownership: `market:{assetId}` for any authenticated actor, `portfolio:{portfolioId}` and `jobs:{jobId}` for their owner, `notifications` for the actor only. An unknown or unauthorized channel is refused with an `ERROR`, and it does not reveal whether it exists.
- S2 `SUBSCRIBE` and `UNSUBSCRIBE` are idempotent, answer `ACK`, and are limited to 50 subscriptions per connection (`4008` beyond that).
- S3 A realtime hub behind its own interface delivers a published event to the subscribed sockets only; each channel has a monotonic `sequence`, and the envelope carries the process `epoch` so a restart is visible.
- S4 The `RealtimePublisher` adapter in `apps/api` feeds the hub; a slow socket that passes the outbound buffer is closed with `4008` and never blocks other sockets.
- S5 Re-authentication reloads role and ownership and drops the subscriptions the actor no longer holds.

## Tasks

- [x] T1 `ChannelAuthorizer` with permission and ownership, tested with fake repositories. `canSubscribe(actor, channel)` returns a boolean, so a missing, foreign or forbidden channel is indistinguishable; `SubscriptionChannel` mirrors the contracts' `RealtimeChannel` (application does not depend on contracts). Pending: user runs the checks and commits.
- [ ] T2 Hub with per-channel `sequence` and `epoch`, and the `RealtimePublisher` adapter.
- [ ] T3 `SUBSCRIBE` and `UNSUBSCRIBE` handling, the 50-subscription limit and the `ERROR` codes.
- [ ] T4 Re-authentication revalidation and the outbound buffer closing a slow socket.

## Done when

Subscription, unauthorized-channel, ordering, duplicate-subscribe and slow-consumer tests pass with a real `ws` client, and an event reaches only the sockets that may see it.

## Risk

Items 2 (authorization of every channel) and 4 (ordering and concurrent delivery). Independent verifier.

## Verification

pnpm typecheck, pnpm lint, pnpm test.

## Log
