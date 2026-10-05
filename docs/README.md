# Documentation

Navigation and rules for `docs/`. This page says where each decision and
requirement lives, which document wins when two disagree, and how the set is
kept consistent.

## Document map

### Specification (SDD)

| Document | Purpose |
| --- | --- |
| [`00-overview.md`](00-overview.md) | Project scope, goals and principles. |
| [`01-product-spec.md`](01-product-spec.md) | Product behavior, users and main flows. |
| [`02-functional-requirements.md`](02-functional-requirements.md) | Numbered functional requirements (FR-NNN) with priorities. |
| [`03-non-functional-requirements.md`](03-non-functional-requirements.md) | Quality attributes: performance, security, reliability, maintainability. |
| [`04-tech-stack.md`](04-tech-stack.md) | Approved technologies and selection rules. |
| [`05-data-model.md`](05-data-model.md) | Entities, fields, relationships and invariants. |
| [`06-architecture.md`](06-architecture.md) | Layers, module boundaries and dependency rules. |
| [`07-api-spec.md`](07-api-spec.md) | HTTP API: endpoints, payloads, errors. |
| [`08-realtime-spec.md`](08-realtime-spec.md) | Realtime transport, channels and events. |
| [`09-security-spec.md`](09-security-spec.md) | Authentication, authorization and data protection. |
| [`10-testing-strategy.md`](10-testing-strategy.md) | Test levels, scope and traceability. |
| [`11-ui-ux-spec.md`](11-ui-ux-spec.md) | Screens, navigation and interaction rules. |
| [`12-demo-mode-spec.md`](12-demo-mode-spec.md) | Public demo on mocked infrastructure. |
| [`13-observability-spec.md`](13-observability-spec.md) | Logging, metrics, health and diagnostics. |
| [`14-deployment-spec.md`](14-deployment-spec.md) | Packaging, configuration and environments. |
| [`15-implementation-plan.md`](15-implementation-plan.md) | Phased implementation roadmap for the whole product. |
| [`16-analytics-spec.md`](16-analytics-spec.md) | Analytics formulas, edge cases and worked examples (ADR-004). |

### Decisions and working documents

| Document | Purpose |
| --- | --- |
| [`adr/`](adr/README.md) | Architecture Decision Records: one closed decision each, with index. |
| [`BACKEND-ROADMAP.md`](BACKEND-ROADMAP.md) | Ordered backend blocks (B0-B7) and their definition of done. |
| [`PROGRESS.md`](PROGRESS.md) | Working log of what has been built and what is next. |

## Precedence

When two sources disagree, the higher one wins and the lower one is corrected:

1. **ADR** (`adr/`)
2. **SDD** (`00`-`16`)
3. **BACKEND-ROADMAP.md**
4. **PROGRESS.md**

Code is evidence of what exists, not authority on what must exist. A
mismatch between code and an ADR or spec is either a bug or a spec section
still marked `Planned`.

## Status legend

Every spec section carries one status:

| Status | Meaning |
| --- | --- |
| `Implemented` | Matches the code on `develop`. |
| `Planned (B#)` | Decided; built in the named backend roadmap block. Work that must land before B0 starts (for example the minimal CI of ADR-006) is `Planned (B0)`. |
| `Planned (FE)` | Decided; built in the frontend stage (web app and demo mode), after the backend blocks. Its breakdown into blocks is defined in `15-implementation-plan.md`. |
| `Deferred` | Out of current scope; not built until a new decision. |

Sections are annotated as each document is aligned with the ADRs (Phases 2-5
of `odd/tasks/sdd-source-of-truth.md`). An unannotated section is not yet
reconciled.

## Maintenance rule

- A change that diverges from a document updates that document **in the same
  pull request**.
- A new open decision is closed in a new ADR before the code depends on it
  (see [`adr/README.md`](adr/README.md)).
- `pnpm docs:check` must pass. It verifies:
  - references to `NN-*.md` and `adr/NNNN-*.md` resolve;
  - code fences carry only a language token (no attributes);
  - each `NN-*.md` starts with `# SDD NN — Title` using its own number;
  - each ADR has the required sections.

## Failure-mode checklist

Apply it when writing or reviewing a spec or an ADR, and at the start of
every implementation block:

| Category | Ask |
| --- | --- |
| Concurrency | What happens when two requests or workers touch the same data at once? |
| Crash and restart | What state is left if the process dies mid-operation? What resumes it? |
| Timeouts and expiry | What happens when a call, token, lock or job outlives its limit? |
| Retries and duplicates | Is a repeated request, message or job safe (idempotent)? |
| Boundary math and data edges | Zero, negative, empty, first/last day, rounding, very large values? |
| Partial failure | What if one step of a multi-step operation succeeds and the next fails? |

## Review exit criterion

Reviews converge instead of looping:

1. Edge cases are found in **one systematic pass** with the checklist above.
2. All findings are fixed in **one batch**.
3. An edge case that does not change a decision goes to the ADR's
   **Deferred detail** section, assigned to its block, and is specified and
   tested when that block is implemented.
4. After the batch, **one** final review. Only a finding that shows a
   decision is wrong or contradictory gets a new commit; any other finding
   goes to Deferred detail and the work proceeds.
