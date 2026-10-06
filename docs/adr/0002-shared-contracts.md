# ADR-002: Shared Contracts Package and Explicit Wire Format

**Status:** Accepted
**Date:** 2026-10-04
**Implemented in:** roadmap block B0 (package and presenters), B6 (OpenAPI)

## Context

Only requests are typed today. Zod request schemas live in
`apps/api/src/schemas/`, where no frontend can import them.

Responses have no declared shape. Controllers return domain objects and
Express serializes them with `JSON.stringify`. The money format works by
accident: `Money` stores its `amount` in a TypeScript `private` field, which
is a compile-time restriction only, and `Decimal` provides its own
`toJSON`. The result is `{ "amount": "100", "currency": "USD" }`, and the API
integration tests already depend on that shape
(`apps/api/src/routes/transactions.routes.test.ts`). Any internal change to
an entity silently changes the API.

ADR-001 makes the demo run the real application layer. The frontend must
then receive the same data in both modes, which requires one declared wire
format shared by the API, the web app and the demo.

`packages/contracts/` already exists as an empty placeholder.

## Decision

1. **Package.** `@trading/contracts` (`packages/contracts`). It depends on
   `zod` and on `@trading/domain` for types and enum values only.
2. **Contents.**
   - Request schemas, moved from `apps/api/src/schemas/`.
   - Response schemas for every endpoint (new).
   - The error envelope `{ error: { code, message, requestId, details? } }`.
   - The pagination `meta` shape `{ page, pageSize, total, totalPages }`.
   - TypeScript types inferred from all of the above (DTOs).
3. **Wire format.**
   - Money: `{ amount: string, currency: string }`, where `amount` is a
     decimal string. This formalizes the current output without breaking it.
   - Dates: ISO-8601 strings in UTC.
   - Percentages and ratios: JSON numbers, for display only. Money values
     are never numbers.
   - Identifiers: strings.
4. **Presenters.** Explicit functions map domain objects to DTOs (for
   example `toPortfolioDto`). They live in `@trading/contracts`. Controllers
   never serialize a domain object directly.
5. **Frontend consumption.** The web app always consumes DTOs through a
   `TradingClient` port with two adapters:
   - HTTP adapter (real mode): calls the API.
   - In-process adapter (demo mode): calls `@trading/application` (ADR-001)
     and the same presenters.

   The UI cannot tell which mode it runs in.
6. **Response validation.** Responses are validated against their schemas in
   the API integration tests (contract tests) and in the demo adapter during
   development. They are not validated at runtime in production.
7. **OpenAPI.** Generated from these schemas in block B6 using Zod v4's
   `toJSONSchema` (available in the installed `zod@4.6.5`). No hand-maintained
   API document.
8. **Evolution.** All routes stay under `/api/v1`. Within a version only
   additive changes are allowed. A breaking change requires a new version.
9. **Persisted JSON** (amended 2026-10-05). Money amounts, prices and
   quantities stored inside JSON columns (`DecisionEvent.payload`, and the
   `Job` and `IdempotencyKey` payloads of ADR-008) are decimal strings, the
   same as on the wire. Domain code parses them with `Decimal`; it never reads
   them as JavaScript numbers. Percentages that are inputs to money
   arithmetic (`Scenario.changes[].percentChange`) may stay JSON numbers, but
   are converted to `Decimal` before any arithmetic. Today
   `decision-replay.ts` reads `price` and `quantity` as numbers, and
   `scenario-impact.ts` computes `1 + percentChange / 100` in floating point.
   This rule replaces both in B0.
10. **API contract details** (added 2026-10-05, from the `07-api-spec.md`
    reconciliation; route parameters added 2026-10-06):
    - **Error codes.** `DEPENDENCY_ERROR` returns 503 when the database is
      unreachable. `FORBIDDEN` returns 403 and is used by role checks from
      B2. `TIMEOUT` is removed from `AppErrorCode` in B0.
    - **Validation details.** Each entry is `{ field, code, message }`.
      `code` is the Zod issue code (for example `too_small`) so the client
      can localize it (ADR-010 point 8). Implemented in B0.
    - **Server request timeout.** None in version 1. The API runs locally
      for one user, and the 15 s client timeout (NFR-017) covers the user
      experience.
    - **Performance response.** `twrPercent`, `pnl` (Money) and
      `series: [{ date, value, returnPercent }]`, where `value` is Money and
      `date` is a UTC calendar date.
    - **Data availability.** Each analytics result carries `status`:
      `OK`, `INSUFFICIENT_DATA` or `UNKNOWN`. Unavailable values are `null`,
      never `0`.
    - **Risk response.** `volatilityPercent`, `maxDrawdownPercent`,
      `currentDrawdownPercent`, `peakDate` and `troughDate`.
    - **Period parameters.** `period` and `from`/`to` are mutually
      exclusive; sending both is 400 `VALIDATION_ERROR`. The default period
      is `1M`.
    - **Theme.** `UserPreference.theme` accepts `light`, `dark` or
      `system` (default `system`); other values are 400. Implemented in B0.
    - **Route parameters.** Route parameters (for example `:portfolioId`)
      are validated with a Zod schema, like body and query (NFR-021). A
      malformed value returns 400 `VALIDATION_ERROR`; a well-formed ID that
      does not exist or is not owned still returns 404 (ADR-005 point 12).
      `Planned (B0)`: today `validate` accepts only `query` and `body`.

## Consequences

**Positive**

- The wire format is declared once and checked by tests instead of emerging
  from serialization details.
- Domain refactors can no longer change the API by accident.
- Real and demo modes return identical DTOs by construction.
- `07-api-spec.md` and the generated OpenAPI document describe the same
  thing, and drift is caught by failing tests.

**Negative**

- Every endpoint needs a response schema and a presenter, written during B0.
- Presenters add a mapping step that is mechanical but must be kept current.

## Alternatives Considered

- **Keep schemas in `apps/api` and generate client types from OpenAPI.**
  Does not give the demo runtime presenters or validation, and delays
  everything to B6. Rejected.
- **Serialize domain objects directly (status quo).** Couples the API to
  internal entity shape. Rejected.
- **Money as a JSON number.** Loses decimal precision, against the precision
  rule in `05-data-model.md`. Rejected.
- **Runtime response validation in production.** Cost without benefit once
  contract tests exist. Rejected.

## Deferred detail

Implementation edge cases that do not change this decision. Each is
specified and tested in the listed block.

| Item | Resolution | Block |
|---|---|---|
| Decimal strings can come out in exponential notation (`decimal.js` `toString` gives `"5e-8"`). | Presenters emit fixed notation, and the response schema enforces a decimal-string pattern. Scale and rounding for computed amounts are defined. | B0 |
| Decision event payloads store `price` and `quantity` as JSON numbers, and replay reads them as numbers (decision point 9). | Replay parses both with `Decimal`. Its readers accept only decimal strings matching the response pattern; a number or a malformed value is reported as an issue, like any other malformed event. Seed data and test fixtures are rewritten to strings. No legacy numeric data needs converting, because nothing is deployed (ADR-006). | B0 |
| Scenario impact computes its price factor in floating point (decision point 9). | `applyScenarioChanges` builds the factor as `Decimal(percentChange).div(100).plus(1)`. A test asserts an exact result for a percentage that is not exactly representable in binary, such as `-12.3`. | B0 |

## Related

- ADR-001 (application layer)
- `07-api-spec.md` (to be reconciled against this decision)
- `10-testing-strategy.md` (contract tests)
- Roadmap block B6 (OpenAPI)
