# B5.1 Realtime contracts and publisher port

Source: roadmap B5; ADR-007 points 3 to 6, 15 and 17; `08-realtime-spec.md` §9, §10, §14, §15, §23. Depends on: B4. Branch: `feat/b5-1-realtime-contracts`.

Working rules: tiny tasks, each approved by the user before any edit (or delegated for the whole slice); no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

packages/contracts/src/**
packages/application/src/**
odd/tasks/b5/**

## Specs

- S1 The event envelope `{ id, type, channel, sequence, timestamp, payload }` is a Zod schema in `@trading/contracts`; all six fields are required, `timestamp` is an ISO-8601 UTC string and money is a decimal string (ADR-002).
- S2 The seven events of version 1 have a payload schema each: `MARKET_PRICE_UPDATED` (with `tickChange`), `PORTFOLIO_UPDATED`, `JOB_PROGRESS_UPDATED`, `JOB_COMPLETED`, `JOB_FAILED`, `NOTIFICATION_CREATED`, `ALERT_TRIGGERED`. Anything else is rejected (a new event needs a new decision).
- S3 A channel name (`market:{assetId}`, `portfolio:{portfolioId}`, `jobs:{jobId}`, `notifications`) is parsed into a typed channel; an unknown or malformed one is refused.
- S4 The protocol messages `AUTHENTICATE`, `SUBSCRIBE`, `UNSUBSCRIBE` and the replies `ACK` and `ERROR` (with a `code`) are Zod schemas; the close codes `4001`, `4002`, `4008` and `1001` are named constants.
- S5 A `RealtimePublisher` port in `@trading/application` takes an event for a channel after a change commits; a no-op and a capturing implementation exist for tests and for the services that run without a socket.

## Tasks

- [ ] T1 Channel names and the envelope schema, with the per-process `epoch` field of the Deferred detail.
- [ ] T2 The seven payload schemas and the discriminated event union, with presenters from the domain types.
- [ ] T3 Client and server protocol messages, the set of `ERROR` codes (decided here, recorded in the Log) and the close-code constants.
- [ ] T4 `RealtimePublisher` port, no-op and capturing implementations, exported from the application index.

## Done when

Valid and invalid envelopes, payloads, channels and messages are pinned by contract tests, and no existing route or service changes.

## Risk

None expected (new contracts and a port nobody calls yet; item 3 only once clients consume them).

## Verification

pnpm typecheck, pnpm lint, pnpm test.

## Log
