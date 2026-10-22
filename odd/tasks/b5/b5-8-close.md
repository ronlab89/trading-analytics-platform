# B5.8 Realtime tests, measurement, docs and close

Source: roadmap B5; `08-realtime-spec.md` §58 to §60; ADR-007; ADR-009 points 10 and 11. Depends on: B5.1 to B5.7. Branch: `docs/close-b5`.

Working rules: tiny tasks, each approved by the user before any edit (or delegated for the whole slice); no subagents; the user runs tests, lint and commits unless asked.

Provisional: the tasks below come from the roadmap and are re-verified against the code, and split further, when the slice starts.

## Allowed edit surfaces

docs/**
apps/api/src/realtime/**
odd/tasks/b5/**

## Specs

- S1 The test list of `08-realtime-spec.md` §59 is covered: connection, authentication, subscription, ordering, duplicate and stale event, reconnect and unauthorized channel; any gap left by B5.2 to B5.7 gets a test here.
- S2 Realtime failure degrades to HTTP: with the socket down every screen's data is still available through the HTTP endpoints, shown by a test.
- S3 The performance measurement the roadmap assigns to B5 is taken (connections, event rate, latency of a tick to a socket) and recorded with its method; ADR-009 metrics stay `Deferred`.
- S4 Every `Planned (B5)` mark is checked against the code and flipped to `Implemented`; marks for FE and later stay. ADR-007 records what B5 built.
- S5 The roadmap status row and `PROGRESS.md` say B5 is done and B6 is next.

## Tasks

- [ ] T1 Fill the §59 gaps with integration tests against a real `ws` client.
- [ ] T2 Take and record the performance measurement.
- [ ] T3 Flip the `Planned (B5)` marks after checking each against the code; ADR-007 "Resolved in B5".
- [ ] T4 Close B5 in the roadmap and PROGRESS.

## Done when

No `Planned (B5)` mark is stale, the §59 list is covered, and the measurement is written down with how it was taken.

## Risk

None (tests and documentation only).

## Verification

pnpm docs:check, pnpm test.

## Log
