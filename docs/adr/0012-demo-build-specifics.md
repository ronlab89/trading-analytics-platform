# ADR-012: Demo Build Specifics

**Status:** Accepted
**Date:** 2026-11-06
**Implemented in:** frontend blocks FE4.1 to FE4.5, with the gaps listed under Consequences

## Context

The demo is decided (ADR-001, ADR-006 point 7, ADR-002 point 5): the same web
code runs against an in-process `TradingClient` and an in-process
`RealtimeClient` instead of the API. What is still open are the specifics that
ADR-010 point 6 sends to a frontend-stage ADR:

- the data layers and the reset (`05-data-model.md` §34-37, FR-067, FR-072);
- the simulated latency (`12-demo-mode-spec.md` §22-23);
- the scripted failures (FR-071; `12-demo-mode-spec.md` §25-28);
- the hosting, the base path, the SPA fallback and the numeric bound of the
  simulation (ADR-006 point 7, `14-deployment-spec.md`).

ADR-011 left these open because the new wireframe was not shared yet. The
Figma file is now the design source, and FE3 delivered the ports the demo
plugs into: `TradingClient`, `RealtimeClient`, the import dialog and
`useJob`, the notifications and the demo menu in the shell (its three actions
are still inert).

`12-demo-mode-spec.md` §18 allows the demo to persist several kinds of state
locally, and §22 only suggests latency profiles (`instant`, `fast`, `normal`,
`slow`) and ranges. Both use "may" and "suggested", so this ADR chooses the
simplest option that keeps the demo honest.

## Decision

1. **Data layer.** The demo state is seeded in memory at the start of every
   session, through the in-memory repositories (`@trading/persistence-memory`)
   and the same application services as real mode. The seed is deterministic:
   the same seed and the same injected clock give the same data.
2. **What survives a reload.** Only a small preferences record under the
   storage prefix `trading-demo:` (the chosen role, the language and the
   reduced-motion choice). No portfolio, transaction or job is persisted.
   Persistence of the data across reloads stays `Deferred` (FR-067).
3. **Reset.** The demo menu offers "Reset demo" behind a confirmation dialog.
   It reseeds the in-memory state and removes every key with the prefix
   `trading-demo:`, so the next screen is the role selection. It touches no
   other storage key.
4. **Identity.** Demo builds show a role selector (`VIEWER`, `TRADER`,
   `ADMIN`) on the login screen. The permission matrix of ADR-005 applies
   unchanged, and there is no refresh cookie.
5. **Latency.** Every call of the in-process `TradingClient` waits a simulated
   time chosen by the kind of operation: 150 to 400 ms for reads (`get`) and
   400 to 900 ms for writes (`post`, `patch`, `delete`). The wait is drawn from
   an injected random source and is disabled with a build-time switch, which
   unit tests and the end-to-end smoke test use. The user cannot change it in
   version 1. The realtime adapter has no added latency.
6. **Scripted failures.** Version 1 scripts two failures, both armed from the
   demo menu and never random: the next CSV import fails with the same job
   states and failure reasons as a real failure (ADR-008 point 13, FR-071),
   and the realtime connection is lost and then restored through the real
   states (`reconnecting`, then `connected`). A request failure and a timeout
   are not scripted.
7. **Simulation bound.** The market simulation ticks once per second, serves
   at most 50 subscribed assets, and pauses while the browser tab is hidden.
8. **Hosting.** The demo is a static build published on Netlify as its own
   site with the base path `/`. The base path is configurable at build time
   (ADR-006 point 7), so the same build can sit under `/<path>/` behind a 200
   rewrite from another site. The SPA fallback is a `netlify.toml` rewrite of
   `/*` to `/index.html` with status 200; no `404.html` copy is used.
9. **Build guarantees.** The demo bundle contains no HTTP adapter, no
   secrets and no API base URL, and the real bundle contains no demo code.
   Both are checked by a test in CI.

## Consequences

- `05-data-model.md` §34-37, FR-067, FR-071, FR-072 and `14-deployment-spec.md`
  stop being `Deferred` for the points above; their statuses point here.
- FE4.1 to FE4.5 implement the points. The demo menu actions (reset,
  connection issue, test notification, fail the next import) become live in
  FE4.4.
- Not built in FE4.1 to FE4.5: the scripted failure of the next CSV import (point 6;
  the "Demo data" menu has three actions, with no "fail the next import") and the base path
  as a build-time option (point 8; the build uses the Vite default `/`, which is what the
  Netlify site needs).
- A reload loses the data of the session, which is what a reviewer of the demo
  expects from a sandbox; the role and the language are not asked again.
- The end-to-end smoke test of the demo needs the latency switch, otherwise
  every write adds up to 900 ms.
- Reads feel fast and writes feel heavy, the way a real backend behaves,
  without a control to tune.

## Alternatives Considered

- **Persist the whole demo state in `localStorage` or IndexedDB.** It keeps
  the work across reloads, but needs a schema version and a migration for the
  stored state (`12-demo-mode-spec.md` §19), and a stale or corrupt state
  breaks the demo with no simple way out. Rejected for version 1.
- **One latency range for every call.** Simpler, but a creation answers as
  fast as a list, which hides the loading states of the writes. Rejected.
- **The four latency profiles with a selector in the menu.** More interface,
  state and tests for little value in a demo. Rejected for version 1.
- **Random failures and timeouts.** They make the demo and its tests
  unpredictable. Rejected; failures are armed on purpose.
- **Publishing under the portfolio site by default.** It couples the demo to
  the rewrite rules of another site. Kept only as an option through the
  configurable base path.
- **GitHub Pages.** It has no rewrite rules, so the SPA fallback needs a
  `404.html` copy that answers with a 404 status. Rejected.

## Deferred detail

| Item | Resolution | Block |
|---|---|---|
| Persistence of the demo data across reloads. | `Deferred` (FR-067); needs a stored-state version and a migration. | FE4 follow-up |
| Latency profiles `fast` and `slow` and a selector in the demo menu. | `Deferred`. | FE4 follow-up |
| Scripted request failures and timeouts. | `Deferred` (FR-071). | FE4 follow-up |
| The exact name of the build-time latency switch and of the preferences key. | Chosen in the implementation, under the prefix `trading-demo:`. | FE4.1, FE4.2 |

## Related

- `05-data-model.md` §34-37
- `12-demo-mode-spec.md` §18-28
- `14-deployment-spec.md`
- `02-functional-requirements.md` FR-067, FR-071, FR-072
- ADR-001 (application layer), ADR-002 point 5 (ports), ADR-005 (roles),
  ADR-006 point 7 (demo under a subpath), ADR-008 point 13 (import failure
  injection), ADR-010 point 6 (the deferral this ADR closes), ADR-011
  (frontend stack)
