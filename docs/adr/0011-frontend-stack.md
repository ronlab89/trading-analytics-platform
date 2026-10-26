# ADR-011: Frontend Stack and Test Tooling

**Status:** Proposed
**Date:** 2026-10-26
**Implemented in:** the frontend phase (not yet implemented)

## Context

`apps/web` holds only `wireframe.html` and `WIREFRAME-PLAN.md`. The backend
blocks B0-B7 are closed, and the frontend phase has no decided stack:

- `04-tech-stack.md` marks the UI library, styling, components, animation,
  server and client state, tables, forms and charts as `Deferred` (§4, §7-13,
  §16). Only the build tool is decided: Vite (ADR-006 points 1, 7 and 8).
- ADR-006 point 11 sends the component test runner, React Testing Library,
  Playwright, the accessibility scanning tool and the HTTP client timeout and
  retry policy to the frontend-stage ADR.
- ADR-002 point 5 requires the web app to consume DTOs through a
  `TradingClient` port with an HTTP adapter and an in-process demo adapter,
  and the UI cannot tell which one it runs on.
- ADR-002 point 10 states the API has no server timeout, so the client owns
  its timeout policy.
- `@trading/contracts` already depends on Zod (`zod` `^4.6.7`).
- ADR-007 serves realtime over WebSocket from the same HTTP server as the API.
- A new wireframe by the UX/UI designer is not yet shared. It was built
  around Recharts, which this ADR confirms.

This ADR decides the stack and the test tooling. It does not decide the demo
specifics of ADR-010 point 6 (data layers, reset, simulated latency, scripted
failures, hosting, base path, SPA fallback), which need the new wireframe.

## Decision

Every choice was made by the user on 2026-10-26.

1. **Rendering library.** React 19, built with Vite (ADR-006).
2. **Styling.** Tailwind CSS is the only styling layer. Hand-written CSS is
   allowed only where Tailwind cannot express the rule, and each such file
   states why.
3. **Components.** shadcn/ui on Radix UI primitives. Components are copied
   into the repository and owned by it, then styled with Tailwind.
   *Clarified on 2026-10-26 in FE0.2:* the shadcn CLI defaults to the Base UI
   primitives (`base-nova`), not Radix. The project uses the `radix-vega`
   style (`--base radix`), which depends on the `radix-ui` package.
4. **Server state.** TanStack Query for fetching, caching, invalidation and
   retries. It sits behind the `TradingClient` port (ADR-002 point 5), so the
   demo adapter feeds the same hooks.
5. **Client state.** Zustand, limited to state that is not server data (UI
   state, filters, session, simulator controls). Server data is never copied
   into a Zustand store.
6. **Routing.** React Router, including role-protected routes
   (ADR-005) and the configurable base path required by ADR-006 point 7.
7. **Charts.** Recharts. The charts contain no financial calculation; values
   come from the API or the application layer (`04-tech-stack.md` §16).
8. **Tables.** TanStack Table with the shadcn Table component for markup.
9. **Forms and validation.** React Hook Form with Zod. Form schemas reuse
   `@trading/contracts` schemas where one exists; the client check only shapes
   the UI and the backend stays authoritative (ADR-005 point 3).
10. **Animation.** CSS and Tailwind only (transitions and keyframes). Motion
    is not adopted. Every animation respects `prefers-reduced-motion`.
    *Clarified on 2026-10-26 in FE0.2:* `tw-animate-css`, the CSS-only
    Tailwind plugin the shadcn components use for open and close transitions,
    is allowed; it ships no JavaScript.
11. **Component tests.** Vitest with React Testing Library, using the same
    runner as the other workspaces.
12. **End-to-end tests.** Playwright, covering the critical flows of
    `10-testing-strategy.md` §33.
13. **Accessibility checks.** axe-core, through `vitest-axe` in component
    tests and `@axe-core/playwright` in end-to-end tests.
14. **CI.** Component, end-to-end and accessibility checks join the workflow
    of ADR-006 point 10 once frontend code exists.
15. **HTTP client timeout and retry** (closes ADR-006 point 11 and ADR-002
    point 10). Applies to the HTTP adapter of the `TradingClient` port only;
    the demo adapter has no network.
    - **Timeout.** Every request times out after 15 seconds on the client.
    - **Reads.** A `GET` is retried up to 2 times, with exponential backoff,
      only after a network error, a timeout, or a 502, 503 or 504 response.
    - **Never retried.** Any 4xx response, including 429 `RATE_LIMITED`.
    - **Writes.** A write is not retried, except a creation that carries an
      `Idempotency-Key` (ADR-008 point 8), which is retried with the same key
      under the same conditions as a read.
16. **Internationalization.** react-i18next, with the `en` and `es` strings
    of ADR-010 point 8. The initial language is `en`; Spanish is active only
    after the user selects it, and the browser language is not used. The
    stored `language` preference works the same in real and demo mode.

## Consequences

**Positive**

- One runner (Vitest) and one engine (Playwright) cover component, end-to-end
  and accessibility checks, with no extra tool.
- Zod schemas are shared with the backend, so form rules and API rules cannot
  drift apart silently.
- Copying shadcn components means no external UI dependency to upgrade, and
  Radix supplies accessible behavior for dialogs, menus and tabs.
- The server/client state split keeps TanStack Query as the single owner of
  API data in both real and demo mode.

**Negative**

- Owning shadcn components means the team maintains them.
- Recharts can degrade with many points updating in real time; this is
  verified against the realtime views before the charts are finalized.
- Without an animation library, layout transitions and complex sequences cost
  more to write.

**Documents to align** (when this ADR is accepted)

- `04-tech-stack.md`: §4, §6-13, §16 and the stack table move from `Deferred`
  to `Planned (FE)`; the component and end-to-end tooling line in §33.
- `06-architecture.md` §7 and §17: library and state ownership.
- `10-testing-strategy.md`: component, end-to-end and accessibility tooling.
- `11-ui-ux-spec.md`: components, charts and tables.
- `docs/adr/README.md`: index row.

## Alternatives Considered

- **Vue, Svelte or Solid instead of React.** Smaller ecosystems for financial
  charts and tables. Rejected.
- **CSS Modules or CSS-in-JS instead of Tailwind.** More manual theming work.
  Rejected.
- **Radix or React Aria without shadcn; hand-built components.** More styling
  work, or accessibility risk in modals and dropdowns. Rejected.
- **SWR or a hand-written fetch layer.** Weaker mutation and invalidation
  control. Rejected.
- **Redux Toolkit or Context only.** More ceremony, or re-render problems with
  live data. Rejected.
- **TanStack Router.** Less established for the base path and role routes.
  Rejected.
- **Lightweight Charts, ECharts or a combination.** The designer built the
  wireframe around Recharts; reviewed again if the new wireframe needs candles
  or very frequent updates. Rejected for now.
- **AG Grid or plain tables.** Heavier, or too little for sorting and
  filtering. Rejected.
- **TanStack Form or hand-written forms.** Less shadcn integration, or repeated
  validation. Rejected.
- **Motion (Framer Motion).** Unneeded for the planned transitions. Rejected;
  reopened by a new ADR if the new wireframe needs complex transitions.
- **No client retries, or retrying every request.** The first shows brief
  network drops as errors; the second can duplicate a write that has no
  `Idempotency-Key`. Rejected.
- **Lingui or react-intl.** More initial setup, or a more verbose API.
  Rejected.
- **Vitest Browser Mode, Storybook, Cypress, Lighthouse CI.** More
  infrastructure or less coverage than the chosen tooling. Rejected.

## Pending UX input

Points that depend on the new wireframe and stay open until the designer
shares it. Closing them moves this ADR to `Accepted`.

| Item | Why it waits |
|---|---|
| Recharts fit for realtime and Decision Replay views | Playback controls and timeline are not in the current wireframe. |
| Component inventory beyond shadcn | Custom components are unknown until the design is seen. |
| Theme, tokens and dark mode | Tailwind configuration follows the design tokens. |
| Demo specifics of ADR-010 point 6 | Data layers, reset, latency, failures and hosting need the final screens. |

## Deferred detail

Implementation edge cases that do not change this decision. Each is
specified and tested in the listed block.

| Item | Resolution | Block |
|---|---|---|
| Tests for each rule of point 15 (timeout, retry on reads, no retry on 4xx, retry of an idempotent creation with the same key). | Written with the `TradingClient` HTTP adapter. | FE |
| Client for the WebSocket of ADR-007 (reconnect, stale-data banner, re-authentication). | Specified with the realtime views against `08-realtime-spec.md`. | FE |
| Exact versions of the libraries above. | Resolved in `pnpm-lock.yaml` and recorded in `04-tech-stack.md`. | FE |

## Related

- `04-tech-stack.md` §4-§16, §33
- `06-architecture.md` §7, §17
- `10-testing-strategy.md` §33
- ADR-002 points 5 and 10 (`TradingClient` port, no server timeout)
- ADR-005 point 3 (backend is authoritative)
- ADR-006 points 7, 8 and 11 (Vite, base path, frontend test tooling)
- ADR-007 (WebSocket transport)
- ADR-010 points 6 and 8 (demo specifics, languages)
