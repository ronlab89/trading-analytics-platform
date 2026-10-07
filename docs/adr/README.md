# Architecture Decision Records

An Architecture Decision Record (ADR) closes one open decision: the context
that forced it, the decision, its consequences and the alternatives rejected.
ADRs have the highest precedence in the documentation set (see
[`../README.md`](../README.md#precedence)). When an SDD document disagrees with
an accepted ADR, the SDD document is wrong and is corrected.

## Index

| ADR | Title | Status | Implementing block |
| --- | --- | --- | --- |
| [001](0001-application-layer.md) | Application Layer as a Shared, Injectable Package | Accepted | B0 |
| [002](0002-shared-contracts.md) | Shared Contracts Package and Explicit Wire Format | Accepted | B0 (package, presenters), B6 (OpenAPI) |
| [003](0003-holdings-only-portfolio.md) | Holdings-Only Portfolio with BUY and SELL Transactions | Accepted | Points 1-5 implemented; point 6 in B0 |
| [004](0004-analytics-methodology.md) | Portfolio Analytics Methodology | Accepted | B1 |
| [005](0005-roles-and-authentication.md) | Roles, Permissions and Session Management | Accepted | B2 (permission checks in B0) |
| [006](0006-deployment-model-and-ci.md) | Deployment Model and Minimal Continuous Integration | Accepted | CI before B0; build and containers in B7; graceful shutdown in B3; demo hosting in the frontend phase |
| [007](0007-realtime-and-market-simulation.md) | Realtime Transport and Shared Market Simulation | Accepted | B5 |
| [008](0008-background-jobs-csv-import.md) | Background Jobs, Scoped to CSV Transaction Import, and Idempotency | Accepted | B4 |
| [009](0009-observability-scope.md) | Observability Scope — Structured, Correlated, Safe Logging | Accepted | B3 (`auth.logout` with B2, simulator entries with B5) |
| [010](0010-v1-product-scope-clarifications.md) | Version 1 Product Scope Clarifications | Accepted | B0, B1, FE |

Blocks (B0-B7) are defined in [`../BACKEND-ROADMAP.md`](../BACKEND-ROADMAP.md).

## Status values

| Status | Meaning |
| --- | --- |
| `Proposed` | Drafted, not yet agreed. Not binding. |
| `Accepted` | Binding. Specs and code follow it. |
| `Superseded` | Replaced by a later ADR, named in a `**Superseded by:**` line. Kept for history. |

## Adding an ADR

1. Copy [`template.md`](template.md) to `NNNN-short-kebab-title.md`, using the
   next free four-digit number.
2. Fill every section. Apply the failure-mode checklist from
   [`../README.md`](../README.md#failure-mode-checklist) before proposing it.
3. Record edge cases that do not change the decision in **Deferred detail**,
   each assigned to its block.
4. Add a row to the index above in the same pull request.
5. Run `pnpm docs:check`; it verifies the required sections.

## Amending an accepted ADR

An accepted ADR is not rewritten silently. To correct a point, edit it and add
an italic, dated correction note directly under the changed point:

```markdown
*Point 5 corrected on 2026-10-04 after review:* the original text said X;
it now says Y because Z.
```

A change that reverses the decision is a new ADR that supersedes the old one;
set the old ADR's status to `Superseded`.
