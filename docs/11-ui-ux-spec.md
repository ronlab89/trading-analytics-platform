# SDD 11 — UI/UX Specification

**Project:** Trading Analytics Platform  
**Status:** Draft  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`, `05-data-model.md`, `06-architecture.md`, `07-api-spec.md`, `08-realtime-spec.md`, `09-security-spec.md`, `10-testing-strategy.md`

---

# 1. Purpose

**Status:** `Reference`

This document defines the UI/UX principles, interaction model, visual behavior, responsive strategy, accessibility requirements, and motion system for Trading Analytics Platform.

The frontend is not built yet. Behavior described here is `Planned (FE)`. The HTML prototype `apps/web/wireframe.html` is the visual reference; "shown in the wireframe" means the prototype already sketches it, not that the product implements it. Acceptance criteria live in `02-functional-requirements.md`; this document references FR IDs instead of repeating them.

Every user-facing string (labels, navigation, validation and error messages, toasts) exists in English and Spanish (ADR-010 point 8, FR-087). The initial language is always English; Spanish is active only after the user selects it, which stores the `language` preference. The browser language is not used, and before login, or in the demo without a stored preference, the UI is in English (ADR-010 point 8).

The interface must communicate:

- technical maturity;
- clarity;
- confidence;
- information density without visual overload;
- operational feedback;
- modern product design;
- strong interaction quality.

The product must feel like a real modern analytics platform rather than a portfolio-only concept.

---

# 2. UX Goals

**Status:** `Reference`

The primary UX goals are:

1. Make complex trading information understandable at a glance.
2. Minimize cognitive load during frequent monitoring.
3. Make important changes visible without becoming distracting.
4. Provide clear feedback for every meaningful action.
5. Make system states understandable.
6. Preserve usability at high information density.
7. Make advanced functionality discoverable without overwhelming new users.
8. Provide a polished experience suitable for both public demo and technical interview demonstration.

---

# 3. Product Experience Principles

**Status:** `Reference`

The interface follows these principles:

### Clarity over decoration

Visual effects must support comprehension rather than exist only for aesthetics.

### Progressive disclosure

Advanced information should appear when relevant rather than being exposed everywhere simultaneously.

### Immediate feedback

Actions should communicate (FR-060, FR-079):

- started;
- in progress;
- completed;
- failed;
- recoverable.

### Consistency

Equivalent interactions must behave consistently throughout the product.

### Resilience

Errors, loading states, empty states, offline states, and realtime interruptions must have intentional UX.

### Information hierarchy

Primary information must remain visually dominant over secondary metadata.

---

# 4. Visual Direction

**Status:** `Reference`

The visual language should feel:

- modern;
- technical;
- refined;
- data-oriented;
- confident;
- slightly futuristic without becoming sci-fi;
- professional enough for a production SaaS product.

Avoid:

- generic dashboard templates;
- excessive glassmorphism;
- excessive gradients;
- decorative charts with little analytical value;
- excessive neon styling;
- unnecessarily rounded everything;
- visually noisy interfaces.

The interface should differentiate itself through composition, interaction, information hierarchy, and purposeful motion.

---

# 5. Layout System

**Status:** `Planned (FE)`; shown in the wireframe

The application uses a panel-based shell (rounded panels separated by a fixed gap). Authentication happens on a separate screen before the shell (§7).

Layout as shown in the wireframe:

```text
┌──────┬──────────────────────────────────────────────────────┐
│      │ Top bar: portfolio / view · notifications · demo     │
│ Rail ├──────────────────────────────────────────────────────┤
│ nav  │                                                      │
│      │                  Main content                        │
│      │                                                      │
│ Set. │                                                      │
│ Acct │                                                      │
├──────┴──────────────────────────────────────────────────────┤
│ Status bar: realtime state · last sync · alerts count       │
└─────────────────────────────────────────────────────────────┘
```

The layout adapts to viewport size (FR-062).

---

# 6. Application Shell

**Status:** `Planned (FE)`; shown in the wireframe

The shell provides:

- primary navigation: an icon rail with tooltips (§7);
- current section: breadcrumb `<portfolio> / <view>` in the top bar;
- portfolio selector in the top bar (FR-005, §11-§12);
- realtime connection state, last sync time and active alerts count in the status bar (FR-046, §14);
- notifications: bell with unread badge and a dropdown with "mark all as read" (FR-051, FR-052);
- user/session controls: avatar menu with "View profile" and "Log out" (FR-003);
- demo controls: a visually distinct "DEMO DATA" menu, present only in the demo (§16).

The shell stays mounted while navigating between views.

---

# 7. Navigation

**Status:** `Planned (FE)`

Top-level destinations, in wireframe order:

| # | Destination | Placement | In wireframe | FR |
| --- | --- | --- | --- | --- |
| 0 | Login / Enter Demo | Separate gate before the shell | Yes | FR-001, FR-002 |
| 1 | Dashboard | Rail | Yes | FR-004, FR-006, FR-007 |
| 2 | Portfolios (list, detail with Positions) | Rail | Yes | FR-008-FR-012 |
| 3 | Transactions | Rail | Yes | FR-014, FR-016-FR-018 |
| 4 | Analytics | Rail | Yes | FR-025-FR-031 |
| 5 | Markets (tabs Watchlist, All Assets, Alerts) | Rail | Yes (Alerts tab not yet) | FR-019-FR-024, FR-053 |
| 6 | Decision Center (tabs Replay, Scenario Lab) | Rail | Yes | FR-032-FR-043 |
| 7 | Activity | — | Yes | `Deferred` (ADR-010 point 9); Notifications and Transactions cover its content |
| 8 | Settings | Rail, bottom | Yes | FR-087 |
| 9 | Profile, Log out | Avatar menu, bottom of rail | Yes | FR-003, FR-087 |
| — | Notifications | Top bar dropdown, not a view | Yes | FR-051, FR-052 |
| — | Demo Controls | Top bar menu, demo only | Yes | FR-048, FR-071, FR-072 |

Required by FRs but not yet in the wireframe:

- Position detail (FR-013), reached from the Positions table;
- Asset detail (FR-021), reached from Markets;
- CSV transaction import with job progress (FR-080, FR-081), reached from Transactions;
- Alert configuration (FR-053): an Alerts tab under Markets listing every alert, plus "Create alert" on asset detail (ADR-010 point 9);
- Settings fields for language, theme, default portfolio, reduced motion and notification preferences (FR-087); the wireframe Settings shows only profile fields.

Positions and Assets are not top-level destinations: Positions live in the portfolio detail and Assets under Markets. There is no Admin view (ADR-005).

Role-based visibility (ADR-005): every role sees every destination for its own data. `VIEWER` has read permissions only, so mutation controls are hidden or disabled; `TRADER` can mutate; only `ADMIN` (`simulation:control`) sees simulation controls (FR-048). The API enforces the same rules (FR-084).

Navigation communicates the current location, the unread notification count and, for `VIEWER`, read-only state. Labels exist in English and Spanish.

---

# 8. Navigation Behavior

**Status:** `Planned (FE)`; direct navigation, active state and tooltips shown in the wireframe

Navigation must support:

- direct navigation;
- active state (sub-views such as portfolio detail keep their parent active);
- keyboard navigation and accessible focus states (FR-063);
- responsive mobile navigation (FR-062);
- preserved portfolio context across views (FR-005).

Navigation transitions must feel immediate and never delay access to content.

---

# 9. Dashboard UX

**Status:** `Planned (FE)`; primary metrics, allocation and recent activity shown in the wireframe

The dashboard is the primary monitoring experience (FR-004, FR-006, FR-007).

It should prioritize:

1. Portfolio value.
2. Performance.
3. Important changes (What Changed, ADR-010 point 1).
4. Positions/exposure.
5. Market activity.
6. Alerts.
7. Recent activity.

No FR requires dashboard customization.

---

# 10. Information Hierarchy

**Status:** `Reference`

Dashboard content should use three levels:

### Primary

Critical information that should be understood immediately.

Examples:

- portfolio value;
- daily change;
- total return;
- risk indicator.

### Secondary

Information useful for analysis.

Examples:

- allocation;
- exposure;
- recent transactions.

Benchmark comparison is `Deferred` (ADR-010 point 7).

### Tertiary

Supporting metadata.

Examples:

- timestamps;
- identifiers;
- calculation status;
- data freshness.

---

# 11. Portfolio Context

**Status:** `Planned (FE)`; selector shown in the wireframe

The selected portfolio is a global context (FR-005). Without a selection, the client uses `defaultPortfolioId` from preferences (FR-087).

Changing portfolio:

- updates overview, positions, transactions, analytics and alerts;
- updates realtime subscriptions (FR-086);
- keeps the current view;
- discards late responses for the previous portfolio (FR-005).

The active portfolio is always visible in the top bar. An archived portfolio is read-only: mutation controls are disabled (ADR-010 point 5).

---

# 12. Portfolio Switching

**Status:** `Planned (FE)`

Expected interaction:

```text
Open selector
      ↓
Choose portfolio
      ↓
Loading state (no values from the previous portfolio)
      ↓
New context and data
```

The previous portfolio's values are never shown under the new one (FR-005). If the selected portfolio is archived, the selection moves to another portfolio or to the empty state (FR-011).

---

# 13. Data Freshness

**Status:** `Planned (FE)`; last-sync text shown in the wireframe

Realtime-sensitive information communicates freshness through the connection state (§14) and a last-sync time.

When the connection is `Disconnected` or `Failed`, a stale-data indicator is shown and data is refetched through HTTP periodically until reconnection (FR-046, ADR-007 point 12). After a reconnect the client resynchronizes through HTTP (FR-047).

The indicator stays subtle unless user action is required.

---

# 14. Realtime Status Indicator

**Status:** `Planned (FE)`; shown in the wireframe status bar with a reduced set of states

A global indicator shows the realtime port state (FR-046):

```text
Connected
Connecting
Reconnecting
Disconnected
Failed
```

The wireframe shows only Live, Connecting and Offline; the product uses the five states above, with labels in English and Spanish.

The indicator does not animate constantly; motion appears only when the state changes (FR-065).

---

# 15. Realtime Data Updates

**Status:** `Planned (FE)`

Realtime changes (FR-044, FR-045, FR-077) must be visually distinguishable without excessive movement:

- value transition;
- subtle highlight;
- directional indicator;
- timestamp update.

The whole dashboard must never flash on every event.

---

# 16. Market Simulation UX

**Status:** `Planned (FE)`; a Demo Controls menu is shown in the wireframe

Simulation control is restricted to `ADMIN` (`simulation:control`, FR-048, ADR-007 point 10). Modes and scenarios follow `12-demo-mode-spec.md` §37-§40.

Possible controls:

```text
Start
Pause
Resume
Speed
Scenario
```

Demo reset (FR-072) and demo failure scenarios beyond FR-071 are `Deferred` (ADR-010 point 6). The wireframe items "Simulate connection issue", "Push test notification" and "Reset demo data" are prototype aids, not decided controls.

The simulation UI communicates current state, speed, event activity and whether realtime updates are active, and is visually distinct from product controls.

---

# 17. Transaction UX

**Status:** `Planned (FE)`; inline creation form shown in the wireframe

Creating a transaction (FR-017, FR-018) is synchronous (ADR-008 point 12):

```text
Form
 ↓
Validation
 ↓
Submit
 ↓
Success / Error
```

The user sees what will be recorded before submitting. On error, input is preserved (FR-076). Bulk entry uses CSV import as a background job (FR-080, FR-081; §30), not yet in the wireframe.

---

# 18. Transaction Form

**Status:** `Planned (FE)`

Forms should:

- group related information;
- use clear labels;
- provide contextual help where useful;
- validate progressively;
- avoid unnecessary validation interruptions;
- show actionable errors.

The form distinguishes (FR-018, FR-059):

```text
Field error
Business rule error
Server error
```

---

# 19. Validation UX

**Status:** `Planned (FE)`; login field errors shown in the wireframe

Validation should be immediate when useful, deferred when it would distract, specific and actionable.

Bad:

```text
Invalid value.
```

Preferred:

```text
Quantity must be greater than 0.
```

Messages are placed next to the affected control and exist in English and Spanish (ADR-010 point 8).

---

# 20. Destructive Actions

**Status:** `Planned (FE)`

Destructive or irreversible actions require explicit confirmation (FR-061). Cancel sends no request.

Version 1 cases:

- archiving a portfolio (FR-011): it is not deleted; history is kept and it becomes read-only; unarchiving is `Deferred`;
- deleting a scenario (FR-043).

No FR covers deleting a transaction. Demo reset is `Deferred` (FR-072).

Dialogs state what will happen, whether it can be undone, the primary action and cancellation.

---

# 21. Tables

**Status:** `Planned (FE)`

TanStack Table provides the behavioral foundation for complex tables.

Tables support where relevant:

- sorting in the client, only for lists loaded in full; paginated lists keep the API order (FR-055, ADR-010 point 4);
- filtering (FR-016);
- pagination (FR-056);
- responsive adaptation (FR-062).

Configurable columns and row selection are `Deferred` (ADR-010 point 9).

---

# 22. Table UX

**Status:** `Planned (FE)`; loading, empty, filtered-empty and error states shown in the wireframe

Tables provide (FR-057, FR-058, FR-059):

```text
Loading
Empty
Filtered empty
Error (with retry)
Success
```

Rows must not jump unpredictably when realtime data changes; high-frequency updates are visually restrained.

---

# 23. Responsive Tables

**Status:** `Planned (FE)`; horizontal scrolling shown in the wireframe

On smaller screens, tables must not shrink until unreadable (FR-062). Depending on importance, use horizontal scrolling, column prioritization, stacked rows, condensed metadata or alternate mobile layouts.

Critical information must remain accessible.

---

# 24. Charts

**Status:** `Planned (FE)`; portfolio value chart shown in the wireframe

Charts are analytical tools, not decoration (FR-025-FR-029).

Every chart must have:

- clear purpose;
- readable axes;
- understandable units;
- useful time range;
- loading state;
- empty state;
- error state;
- accessible supporting information where practical (FR-064).

---

# 25. Chart Interaction

**Status:** `Planned (FE)`; range buttons shown in the wireframe

Where applicable, users can:

- change the time range (periods per FR-025, FR-026);
- hover/inspect values;
- toggle relevant series;
- inspect important points.

Comparison with a benchmark is `Deferred` (ADR-010 point 7).

Interactions must remain responsive with large datasets.

---

# 26. Analytics UX

**Status:** `Planned (FE)`; Analytics view shown in the wireframe

Analytics (FR-025-FR-031) supports progressive exploration:

```text
Overview
   ↓
Metric
   ↓
Breakdown
   ↓
Detailed Data
```

The user should not need to understand the underlying data model to use analytics. Metric definitions live in `16-analytics-spec.md`.

---

# 27. Empty States

**Status:** `Planned (FE)`; empty states shown in the wireframe

Behavior is defined by FR-058. An empty state explains:

1. what is missing;
2. why it matters;
3. what the user can do next (hidden for `VIEWER` when the action is a mutation, §7).

Example structure:

```text
No transactions yet

Add your first transaction to start building
portfolio analytics.

[ Add Transaction ]
```

An empty portfolio (valid, zeroed) looks different from `InsufficientData` or `UNKNOWN` (FR-058).

---

# 28. Error States

**Status:** `Planned (FE)`

Behavior is defined by FR-059. Errors are contextual: network failures and 5xx offer retry; a 400 offers correction next to the fields, not retry; valid user state is preserved (FR-076). Messages exist in English and Spanish (ADR-010 point 8).

Structure:

```text
What happened
Why it matters
What can be done
```

Examples:

```text
Unable to load analytics.
[ Retry ]

Realtime connection interrupted.
Reconnecting automatically...

Transaction could not be completed.
Review the highlighted fields.
```

Reconnection follows ADR-007 (§14).

---

# 29. Loading States

**Status:** `Planned (FE)`; skeletons shown in the wireframe

Behavior is defined by FR-057. Targets: visible feedback within 100 ms of every action (NFR-061); a loading indicator whenever a view is not ready within 300 ms (NFR-002).

Use the appropriate loading pattern:

### Skeleton

For content-heavy layouts where the structure is known.

### Spinner

For localized short operations, such as a pending mutation control (disabled while pending, FR-057).

### Progress

For CSV import jobs, from the job's `{ processed, total }` progress (FR-081, §30).

### Optimistic feedback

Only when the action can safely be represented before server confirmation; it is rolled back on failure (NFR-061).

Avoid generic full-screen spinners for normal navigation.

---

# 30. Background Process UX

**Status:** `Planned (FE)`

The only background process in version 1 is the CSV transaction import job (FR-080, FR-081, ADR-008). It does not block the interface:

```text
Start
 ↓
QUEUED / PROCESSING
 ↓
Progress { processed, total }
 ↓
COMPLETED / FAILED / CANCELLED / TIMED_OUT
```

- Progress is a field of the job, updated by `jobs:{jobId}` events (B5) or by reading the job (ADR-008).
- Retry is offered only where FR-081 allows it and returns the job to `QUEUED`; cancel is offered while `QUEUED` or validating and requires confirmation (FR-061).
- Simulated progress exists only in the demo (ADR-008).

The user can keep using unrelated parts of the application while a job runs.

---

# 31. Process Center

**Status:** `Deferred` — no FR or ADR defines a cross-process center; version 1 shows import job state, progress, `attempt`, failure reason and retry/cancel inside the import flow (FR-081, §30).

---

# 32. Notifications

**Status:** `Planned (FE)`; bell, unread badge, dropdown and "Mark all as read" shown in the wireframe

Behavior is defined by FR-051 and FR-052. A notification is `unread` or `read`; there is no dismissed state (ADR-010 point 3). The user marks one or all as read.

In version 1 a notification is created when an alert triggers (FR-053) or when a CSV import job reaches `COMPLETED` or `FAILED` (FR-081); it arrives in realtime with `NOTIFICATION_CREATED` (ADR-007). Connection changes create no notification; they appear only in the status bar (FR-046, §14). Transient feedback uses toasts (§33), not notifications (ADR-010 point 9).

Avoid notification spam: an alert fires only on a false-to-true transition (FR-053).

---

# 33. Toasts

**Status:** `Planned (FE)`; toast system (success, error, warning, info) shown in the wireframe

Toasts give transient feedback, such as the success confirmations of FR-060 and temporary connection state. They are announced to assistive technology (FR-064); the wireframe container is `aria-live="polite"`.

Critical information must not exist only inside a toast.

---

# 34. Alerts

**Status:** `Planned (FE)`; active alerts count shown in the wireframe status bar

Alerts are user-configured conditions of type `PRICE`, `PORTFOLIO_CHANGE`, `ALLOCATION` or `VOLATILITY` (FR-053). Evaluation is `Planned (B5)`.

- A configured alert stays listed until the user deletes it; deletion requires confirmation (FR-061).
- A triggered alert creates a notification (§32), which stays discoverable until read.
- System conditions such as delayed data or a failed import are shown by the freshness indicator (§13) and the import flow (§30), not as alerts.

Alerts are managed in an Alerts tab under Markets, which lists every alert; asset detail also offers "Create alert" (ADR-010 point 9, §7). Neither is in the wireframe yet.

---

# 35. Alert Severity

**Status:** `Planned (FE)`; matching toast variants shown in the wireframe

There is no separate alert severity. Notifications use the `NotificationSeverity` enum (`05-data-model.md` §21; ADR-010 point 9):

```text
INFO
SUCCESS
WARNING
ERROR
```

| Source | Severity |
| --- | --- |
| Triggered alert | `WARNING` |
| CSV import job `COMPLETED` | `SUCCESS` |
| CSV import job `FAILED` | `ERROR` |

Do not rely on color alone (NFR-029). Severity also uses:

- iconography;
- text;
- placement;
- semantic attributes.

---

# 36. Modal and Dialog Behavior

**Status:** `Planned (FE)`; not in the wireframe

Confirmation dialogs are defined by FR-061; dismissing one sends no request. Dialogs must (NFR-030, FR-064):

- trap focus;
- provide accessible labels;
- close with Escape;
- return focus to the triggering element;
- prevent accidental background interaction.

Dialogs are not used for normal navigation.

---

# 37. Tooltips

**Status:** `Planned (FE)`; rail tooltips shown in the wireframe

Tooltips clarify unfamiliar interface elements. They never hold essential information that cannot otherwise be accessed, and they are reachable by keyboard focus (FR-063).

On touch devices, tooltip-dependent information has an alternative interaction.

---

# 38. Search and Filters

**Status:** `Planned (FE)`; filter bars shown in the wireframe

Transactions are filtered with FR-016; assets are searched with FR-020; there is no separate transaction search (FR-015). Global search is `Deferred` (FR-054). Sorting of fully loaded lists is client-side (FR-055, ADR-010 point 4).

Search/filter interactions:

- preserve selected criteria;
- communicate active filters;
- reset to the unfiltered first page (FR-016);
- provide empty filtered states (FR-058);
- avoid full-page reloads.

A clear distinction exists between:

```text
No data
```

and:

```text
No results for current filters
```

---

# 39. Motion Design

**Status:** `Reference`

Motion is part of the product language. It communicates:

- state change;
- hierarchy;
- continuity;
- feedback;
- causality.

Motion is never required to understand the interface, and every rule below yields to reduced motion (§44).

---

# 40. Animation Principles

**Status:** `Reference`

Animations are:

- purposeful;
- short;
- interruptible where possible;
- consistent;
- subtle for frequent updates;
- more expressive for major transitions.

Avoid excessive simultaneous animations.

---

# 41. Microinteractions

**Status:** `Planned (FE)`

Microinteractions provide the visible feedback within 100 ms of NFR-061:

- button feedback;
- successful save;
- toggles;
- expanding details;
- row updates;
- connection changes;
- notification appearance.

They reinforce user actions rather than distract from the main task, and are removed under reduced motion (§44).

---

# 42. Page Transitions

**Status:** `Planned (FE)`

Page transitions may use lightweight motion. They:

- never delay the visible response of NFR-002 (100 ms);
- preserve spatial continuity;
- are disabled under reduced motion (FR-065);
- remain performant.

---

# 43. Realtime Animation

**Status:** `Planned (FE)`

Realtime values (ADR-007) may use subtle numeric transitions, never long ones. The visual response communicates:

```text
New value
+
Direction
+
Recency
```

without creating visual noise. Under reduced motion, direction and recency stay visible as static text or icons (FR-065).

---

# 44. Reduced Motion

**Status:** `Planned (FE)`; `prefers-reduced-motion` handling shown in the wireframe

Behavior is defined by FR-065. The application respects:

```text
prefers-reduced-motion
```

and the reduced-motion preference in Settings (FR-087). When enabled:

- non-essential animation is disabled;
- transitions are removed or shortened;
- realtime decorative animations are removed;
- Decision Replay remains usable step by step;
- functionality is unchanged.

---

# 45. Accessibility

**Status:** `Planned (FE)`

Accessibility is a product requirement. Core workflows meet WCAG 2.2 AA, with 0 serious or critical automated violations on core routes (NFR-029).

Key requirements:

- keyboard access (FR-063, NFR-030);
- semantic HTML and logical heading hierarchy;
- visible focus;
- accessible names and proper form labeling;
- contrast of 4.5:1 for text and 3:1 for large text and UI components (NFR-029);
- meaningful error messages (FR-059);
- state changes announced to screen readers (FR-064, NFR-031).

---

# 46. Keyboard Navigation

**Status:** `Planned (FE)`

Behavior is defined by FR-063 and NFR-030. Keyboard users can:

- navigate;
- open controls;
- submit forms;
- close dialogs;
- interact with tables;
- change filters;
- access notifications.

Focus is never trapped unintentionally; only open dialogs trap focus (§36).

---

# 47. Focus Management

**Status:** `Planned (FE)`

Focus is intentionally managed (FR-064, NFR-030) after:

- opening dialogs (focus moves in);
- closing dialogs (focus returns to the trigger);
- navigation;
- form errors;
- dynamic content changes where necessary.

The user's position in the interface remains understandable.

---

# 48. Screen Reader Considerations

**Status:** `Planned (FE)`

Behavior is defined by FR-064 and NFR-031: loading, success, error, stale-data and connection-status changes are announced through live regions; charts have a text alternative.

Examples:

```text
Transaction recorded
Connection lost
Connection restored
Import completed
```

High-frequency market updates are not announced individually.

---

# 49. Color Usage

**Status:** `Planned (FE)`; profit, loss, warning and info color tokens shown in the wireframe

Color is never the only indicator of meaning (NFR-029). For example:

```text
Profit
Loss
Warning
Error
```

combine color with:

- symbols;
- labels;
- icons;
- directional indicators.

Contrast meets 4.5:1 for text and 3:1 for large text and UI components (NFR-029).

---

# 50. Typography

**Status:** `Reference`; monospaced tabular numerals shown in the wireframe

Typography prioritizes:

- readability;
- numerical clarity;
- hierarchy;
- consistent rhythm.

Financial numbers use tabular numerals and the formatting of §51, so magnitude and precision are easy to scan.

---

# 51. Number Formatting

**Status:** `Planned (FE)`; display precision per value type decided in ADR-010 point 9 (rounding is a UI concern, ADR-002 point 3)

Numbers are formatted only at display time, with the active locale through `Intl` (ADR-010 point 8, NFR-066). Calculations never use the formatted text.

- **Money** arrives as a decimal string with its currency (ADR-002). It stays a decimal string until it is formatted; the currency symbol and placement come from the locale and the DTO currency, never a hard-coded `$`.
- **Percentages** arrive as numbers in percentage points (`twrPercent`, `unrealizedPnLPercent`; ADR-004, `16-analytics-spec.md` §2) and are rounded only for display.
- **Missing values** (`null`, `InsufficientData`) show an explicit "not available" label, never `0` or `0%`.
- **Displayed decimals** (ADR-010 point 9), applied at display time only: money uses the currency's minor units through `Intl` (2 for USD); prices use 2 decimals when ≥ 1 and up to 8 when < 1; quantities show up to 8 decimals without trailing zeros; percentages use 2 decimals.
- **Sign**: positive and negative values carry an explicit sign and the color rules of §49.

Examples (`en` locale; `es` uses its own separators):

```text
$125,430.25
+4.82%
-1.27%
1,250 units
```

---

# 52. Date and Time Formatting

**Status:** `Planned (FE)`

Dates and times are formatted with the active locale through `Intl` (ADR-010 point 8, NFR-066). Two kinds of value are shown differently:

- **Timestamps** (for example `executedAt`, notification times) are shown in the user's local time zone. Realtime information shows relative freshness, with the exact timestamp available on demand.
- **Analytics days** (series points, `from`, `to`, `asOf`) are UTC calendar dates (ADR-004; `16-analytics-spec.md` §2). A UTC day is labeled as that calendar date, formatted with the locale and the UTC time zone, with no time of day and no shift to the user's time zone (ADR-010 point 9). When `asOf` differs from the requested `to`, the UI states the `asOf` date.

Examples (`en` locale):

```text
Just now
2 min ago
Aug 31, 13:24
Aug 31, 2026 (UTC day)
```

---

# 53. Responsive Strategy

**Status:** `Planned (FE)` (FR-062)

Layouts reorganize content by priority rather than scaling the desktop layout down, and every P0 workflow works without horizontal page scrolling (FR-062).

Primary layout modes (ADR-010 point 9):

```text
Mobile    360-560 px
Tablet    561-900 px
Desktop   > 900 px
```

The minimum supported viewport width is 360 px.

---

# 54. Mobile Experience

**Status:** `Planned (FE)` (FR-062); a 560 px layout is shown in the wireframe

Mobile is not a reduced desktop. Priorities:

- essential metrics;
- portfolio context;
- important alerts;
- key actions;
- compact navigation;
- readable charts;
- manageable tables.

Secondary analytical detail can move behind progressive disclosure.

---

# 55. Tablet Experience

**Status:** `Planned (FE)` (FR-062); a 900 px layout is shown in the wireframe

Tablet layouts support analytical workflows without desktop-only assumptions. Two-column layouts may collapse selectively, and navigation may become more compact.

---

# 56. Desktop Experience

**Status:** `Planned (FE)` (FR-062)

Desktop uses the available space for analytical comparisons, multi-column layouts, detailed tables, charts and activity panels, while keeping whitespace around dense data.

---

# 57. Responsive Breakpoint Philosophy

**Status:** `Reference`; breakpoints `max-width: 900px` and `max-width: 560px` shown in the wireframe

Breakpoints follow layout needs, not device names, and stay few and consistent. The breakpoints are 900 px and 560 px (`max-width`), and the minimum supported viewport width is 360 px (ADR-010 point 9, FR-062).

---

# 58. Design Tokens

**Status:** `Planned (FE)`; color, spacing, radius, typography, duration and easing tokens shown in the wireframe

Design decisions are centralized in reusable tokens. Categories:

```text
Colors
Typography
Spacing
Radius
Shadows
Motion
Z-index
Breakpoints
```

Components consume tokens instead of duplicating arbitrary values.

---

# 59. Component System

**Status:** `Reference` (NFR-035)

Conceptual hierarchy:

```text
Design Tokens
    ↓
UI Primitives
    ↓
Shared Components
    ↓
Feature Components
    ↓
Pages
```

Each primitive is defined once and generalized only with at least two real uses (NFR-035).

---

# 60. Component States

**Status:** `Planned (FE)` (FR-057, FR-059, FR-060)

Interactive components define their applicable states intentionally:

```text
Default
Hover
Focus
Active
Disabled
Loading
Success
Error
```

---

# 61. Buttons

**Status:** `Planned (FE)`

Buttons communicate action, importance and current state. Primary actions are visually distinct; destructive actions use semantic treatment and confirmation (FR-061). A loading button prevents duplicate submissions.

---

# 62. Inputs

**Status:** `Planned (FE)` (FR-059, FR-064, NFR-029)

Inputs have visible labels, focus, disabled, loading (where relevant) and error states, and helper text. Validation errors appear next to their field (FR-059). Placeholder text never replaces a label.

---

# 63. Data Density

**Status:** `Reference`

High information density is supported through compact secondary metadata, grouping, progressive disclosure, consistent alignment and restrained decoration, not by making everything smaller.

---

# 64. Visual Differentiation

**Status:** `Reference`

The product feels original through its dashboard composition, information hierarchy, scenario-driven interactions, realtime visual language, process visualization, meaningful motion and considered empty and error states. It does not imitate a known trading product.

---

# 65. Unique Product Features

**Status:** `Reference`

The unique features of `01-product-spec.md` (for example Decision Replay and Scenario Lab) are integrated into the core workflow, not presented as isolated gimmicks. Useful differentiation takes priority over novelty.

---

# 66. Demo UX

**Status:** `Planned (FE)` (FR-066); a "DEMO DATA" badge and demo notice are shown in the wireframe

The demo is the same application: it runs the real application layer in process through the `TradingClient` adapter, as a static build with no backend and no secrets (ADR-001, ADR-002 point 5, ADR-006; FR-066). Every non-`Deferred` user-facing requirement works in it.

The visitor can tell immediately that data is simulated (a persistent demo indicator) and what is interactive. Seed data is not translated (ADR-010 point 8).

---

# 67. Demo Guidance

**Status:** `Deferred` — no FR or ADR defines contextual demo hints; decide in the frontend-stage demo ADR (ADR-010 point 6)

If added, guidance is dismissible, unobtrusive and never turns the product into a guided-tour-only experience.

---

# 68. Demo Reset

**Status:** `Deferred` (FR-072) — demo data layers and reset are decided in the frontend-stage demo ADR (ADR-010 point 6); a "Reset demo data" control is sketched in the wireframe but not specified

The scope of a reset (seed data, simulation, notifications, jobs, preferences) and whether it needs confirmation are decided by that ADR.

---

# 69. Error UX in Demo

**Status:** real-rule errors and CSV import failure injection `Planned (FE)` (FR-071, FR-069, ADR-008 point 13); other scripted failures (request failure, timeout, connection loss) and simulated latency `Deferred` (ADR-010 point 6, FR-068); a "Simulate connection issue" control is sketched in the wireframe but `Deferred`

- Validation errors and rejected operations (for example an oversell) occur through the real rules, without scripting (FR-071).
- An injected import failure produces the same job states and failure reasons as in the real mode (FR-069, FR-081), with the same retry path:

```text
Import job
   ↓
Injected failure
   ↓
FAILED state
   ↓
Retry
   ↓
QUEUED
```

Demo errors must not imply that the demo is connected to real financial infrastructure.

---

# 70. UX Performance

**Status:** `Planned (FE)` (NFR-001, NFR-003, NFR-008, NFR-062)

Targets: LCP ≤ 2.5 s, CLS ≤ 0.1 and INP ≤ 200 ms (NFR-001, NFR-003); large chart datasets per NFR-008. Avoid unnecessary large DOM trees, excessive animation, expensive blur, continuous layout recalculation and rendering large datasets at once. Use virtualization, justified memoization, lazy loading and narrow state subscriptions where they help meet those targets.

---

# 71. Perceived Performance

**Status:** `Planned (FE)` (NFR-061, NFR-002, FR-057)

Every action shows feedback within 100 ms (NFR-061); a view not ready within 300 ms shows a loading indicator (NFR-002). Skeletons, optimistic updates (rolled back on failure) and progressive rendering reflect real application state.

---

# 72. UX Error Recovery

**Status:** `Planned (FE)` (FR-059, FR-060)

Recoverable errors expose the next logical action. Network failures and 5xx offer retry; a 400 offers correction; valid user state is preserved (FR-059). Recoverable failures never require reloading the application.

```text
Retry
Reconnect
Refresh
Undo
Dismiss
Review
```

---

# 73. UX Consistency Rules

**Status:** `Planned (FE)`

Equivalent states use equivalent patterns. Every asynchronous operation communicates its outcome the same way (FR-057, FR-059, FR-060):

```text
Loading → Success
Loading → Error
Loading → Retry
```

All dialogs share focus and close behavior (§36, §47), and all notifications share severity conventions.

---

# 74. UI/UX Acceptance Criteria

**Status:** `Planned (FE)`

The UI/UX implementation is complete when the referenced requirements pass:

- **Layout:** FR-062 at the supported breakpoints (§57) on the browsers of NFR-063.
- **States and feedback:** FR-057, FR-058, FR-059, FR-060, FR-061; NFR-002, NFR-061.
- **Accessibility:** FR-063, FR-064, FR-065; NFR-029, NFR-030, NFR-031, NFR-032.
- **Performance:** NFR-001, NFR-003, NFR-008.
- **Localization and formatting:** NFR-066 and §51-§52.
- **Demo:** FR-066 to FR-071 within their non-`Deferred` scope.
- **Reuse:** NFR-035; no major screen exists only as static decoration.

---

# 75. UX Philosophy Summary

**Status:** `Reference`

> **Complex under the hood, simple in the hands of the user.**

Strong engineering and strong product design are not separate concerns. The experience combines:

```text
Architecture
+
Data
+
Realtime
+
Interaction
+
Motion
+
Accessibility
+
Performance
```

into one coherent product experience.
