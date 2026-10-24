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

- [x] T1 Fill the §59 gaps with integration tests against a real `ws` client. B5.2 to B5.7 already covered most of §59; added to `realtime-delivery.test.ts` another user's job refused like an unknown one and a reconnect that gets nothing until it subscribes again (sequence continues, epoch kept), and `http-fallback.test.ts` (every screen endpoint mounted on an app with no socket, and `app.ts` imports nothing realtime). Commit 95e5df3.
- [x] T2 Take and record the performance measurement. `measure-realtime.ts` (3119033); results and method in `08-realtime-spec.md` §63.
- [x] T3 Flip the `Planned (B5)` marks after checking each against the code; ADR-007 "Resolved in B5". 378 marks became `Implemented` (B5); stale "no WebSocket code exists" prose rewritten; alert evaluation marks narrowed to `PRICE` alerts (other types `Deferred`). Commit f7d1cbf.
- [x] T4 Close B5 in the roadmap and PROGRESS. In the f7d1cbf docs commit and the closing commit.

## Done when

No `Planned (B5)` mark is stale, the §59 list is covered, and the measurement is written down with how it was taken.

## Risk

None (tests and documentation only).

## Verification

pnpm docs:check, pnpm test.

## Log

L1 Request: "haz todos los pasos de B5.8 tu mismo con los commits en cada paso sin atribucion, las decisiones quedan aprobadas con tus recomendaciones, al finalizar paras para que hagamos el PR"
L2 Decisions taken with the recommendation:

- D1 The measurement is a script in `apps/api/src/realtime/` (inside the allowed surfaces), not a test, so it never slows `pnpm test`. It runs saturated and at the simulator's real rate.
- D2 The flip is `Planned (B5)` to `Implemented` (B5), the shape B4 used. Statements that no realtime code exists were rewritten.
- D3 Alert evaluation covers `PRICE` `ABOVE`/`BELOW` only (B5.7 D1), so the marks that said "alert evaluation" say so and mark the other types `Deferred`.
- D4 The measurement lives in a new `08-realtime-spec.md` §63, linked from ADR-007 "Resolved in B5"; ADR-009 metrics stay `Deferred`.
- Checks: `pnpm docs:check` passes; the touched suites pass with the `.env.test.example` values. DB-backed suites were not run (no database in the session).
- Risk: none (tests, a script and documentation).
