# SDD 16 — Analytics Specification

**Project:** Trading Analytics Platform  
**Status:** Written on 2026-10-05 from ADR-004; current-state metrics reconciled with `packages/domain/src/calculations/`  
**Version:** 1.0  
**Depends On:** `02-functional-requirements.md`, `05-data-model.md`, `06-architecture.md`, `07-api-spec.md`  
**Decisions:** ADR-002 (`adr/0002-shared-contracts.md`), ADR-003 (`adr/0003-holdings-only-portfolio.md`), ADR-004 (`adr/0004-analytics-methodology.md`), ADR-007 (`adr/0007-realtime-and-market-simulation.md`)

---

# 1. Purpose

**Status:** `Implemented`

This document turns ADR-004 into formulas, inputs, edge cases and
hand-computed examples precise enough to write unit tests from. It adds no
decision: where ADR-002, ADR-003 or ADR-004 is silent, the item is an
**Open detail** assigned to a roadmap block, or a gap reported in §17.

Each section states its status (legend in `docs/README.md`), the ADR points
it implements and the functional requirements it serves
(`02-functional-requirements.md`). Formulas use this notation:

```text
d            a UTC calendar date (ADR-004 Deferred detail; 05-data-model.md §40)
d−1          the previous calendar date
a            an asset held by the portfolio
q(a, d)      quantity of a held at the end of d, from transactions with executedAt ≤ end of d
c(a, d)      daily close of a on d (HistoricalPrice.close), carried forward per §5
Σ, Π         sum and product over the stated range
```

Out of scope: scenario impact and comparison (`scenario-impact.ts`,
`scenario-comparison.ts`) and decision replay (`decision-replay.ts`) are not
governed by ADR-004. Decision replay has a known open issue: it reads
`DecisionEvent.payload` prices as JavaScript numbers, against ADR-002's money
rule; it is tracked as task T2.5 of `odd/tasks/sdd-source-of-truth.md` and is
not resolved here.

---

# 2. Common Rules

**Status:** `Planned (B1)` except where marked.  
**Decisions:** ADR-002 point 3; ADR-004 points 12 and 14.  
**Requirements:** FR-025 to FR-031, FR-058.

- **Money.** Values, flows, P/L and contributions are `Money` (decimal,
  `decimal.js`) and leave the API as `{ amount: string, currency: string }`
  (ADR-002 point 3). Money is never converted to a JavaScript number for
  arithmetic.
- **Returns and percentages.** Returns, ratios and percentages are JSON
  numbers, for display only (ADR-002 point 3, ADR-004 point 14). Existing
  fields named `*Percent` carry percentage points (`0.05` return →
  `5`), for example `volatilityPercent`, `changePercent` (`Implemented`).
- **Single currency.** Every metric is computed in the portfolio's
  `baseCurrency`. A transaction on an asset whose currency differs is
  rejected with 400 (ADR-004 point 12, `Planned (B1)`; `05-data-model.md`
  §9.2). Today mixed currencies make `Money.add` throw
  `CurrencyMismatchError`, which surfaces as 500 (`Implemented`, to be
  replaced). Multi-currency is `Deferred`.
- **Empty versus insufficient.** An empty portfolio is a valid state with
  zeroed or empty results (FR-058). Missing data for something that is held
  is `InsufficientData` (`InsufficientDataError` in the domain) or
  `UNKNOWN`, never a fabricated value (`Implemented` convention,
  `drawdown.ts`, `portfolio-daily-change.ts`).
- **Day boundaries.** Days are UTC calendar dates everywhere, including the
  demo and the simulator clock (ADR-004 Deferred detail, `Planned (B1)`).

Open detail (B1):

- Whether daily returns are computed in `Decimal` and converted to a number
  only in the presenter, or in floating point as the current calculations do
  (`toNumber()` before dividing). Either satisfies ADR-004 point 14; tests
  compare returns with a tolerance of `1e-9`.
- The unit of `TWR` on the wire (fraction or percentage points) is fixed with
  the response schema in `07-api-spec.md` §20 (ADR-002).
- Scale and rounding of computed money amounts follow ADR-002 Deferred detail
  (B0); this document adds no rounding of its own.

---

# 3. Daily Value Series

**Status:** `Planned (B1)`  
**Decisions:** ADR-004 point 1; ADR-003 points 1-3 and 6; ADR-007 point 8.  
**Requirements:** FR-025, FR-026.

```text
V(d) = Σ_a q(a, d) × c(a, d)
```

Inputs (`05-data-model.md`):

- `Transaction` (§9): `assetId`, `type`, `quantity`, `price`, `fees`,
  `executedAt`, `status`.
- `HistoricalPrice` (§20): `assetId`, `timestamp`, `close`.
- `Portfolio.baseCurrency` (§6).

Rules:

1. The series is reconstructed from transactions and daily candles on every
   request; it is not stored and not cached until measured (ADR-004,
   Consequences).
2. `q(a, d)` counts `BUY` as `+quantity` and `SELL` as `−quantity` for every
   transaction with `executedAt` on or before the end of `d` (UTC). It never
   uses the stored `Position` row.
3. `q(a, d) ≥ 0` for every `a` and `d`, guaranteed by ADR-003 point 6
   (chronological validation, `Planned (B0)`). Therefore `V(d) ≥ 0`.
4. The series ends at the last closed UTC day. Candles come from the seed
   and from the simulator's daily closes (ADR-007 point 8, `Planned (B5)`).

Edge cases:

| Case | Expected |
| --- | --- |
| No transactions | No series; the portfolio is empty (FR-058). |
| Days before the first transaction | `V(d) = 0`. |
| Several transactions on one day, including the same `executedAt` | `V(d)` depends only on the end-of-day quantity, so the ADR-003 tiebreak (`executedAt`, then creation order) does not change `V(d)`, `B(d)` or `S(d)`. Test: a `BUY` and a `SELL` sharing a timestamp give the same `V(d)` in either order. |
| Backdated transaction | Changes `q(a, d)` from its day onward; since the series is rebuilt per request, the next read reflects it. |
| Asset fully sold | `q(a, d) = 0`; the asset contributes `0` and needs no price. |

Open detail (B1): which transaction `status` values are counted
(`05-data-model.md` §10); only executed transactions represent holdings.

---

# 4. Cash Flows

**Status:** `Planned (B1)`  
**Decisions:** ADR-004 point 2; ADR-003 point 3.  
**Requirements:** FR-025.

```text
B(d) = Σ_{BUY on d}  (quantity × price + fees)
S(d) = Σ_{SELL on d} (quantity × price − fees)
F(d) = B(d) − S(d)
```

Every `BUY` is an external inflow and every `SELL` an external outflow
(ADR-003 point 3); there is no cash balance (ADR-003 point 2). Fees increase
inflows and reduce outflows, so they reduce the return. `B`, `S` and `F` are
`Money`.

Edge cases:

| Case | Expected |
| --- | --- |
| No trades on `d` | `B(d) = S(d) = F(d) = 0`. |
| `SELL` fees greater than gross proceeds | Would make `S(d) < 0`. Open detail (B1, ADR-004 Deferred detail): reject such a `SELL`, or count the excess as an inflow. `05-data-model.md` §9.2 tracks the validation. |

---

# 5. Missing Prices and Insufficient History

**Status:** `Planned (B1)`  
**Decisions:** ADR-004 points 6 and 7, Deferred detail (period boundaries).  
**Requirements:** FR-025, FR-026, FR-058.

- **Carry forward.** If `a` is held on `d` and has no candle on `d`,
  `c(a, d)` is the last close before `d`. This covers gaps of any length
  (offline days, weekends if the series has no candle on them).
- **Never priced.** If `a` is held on `d` and has no candle on or before
  `d`, the range containing `d` is `InsufficientData`. No value is
  extrapolated backwards.
- **Clamping.** A period that starts before the first available data is
  clamped, and the response states `effectiveFrom`: the first day on which
  every held asset has a price (ADR-004 Deferred detail).

Edge cases:

| Case | Expected |
| --- | --- |
| Backdated `BUY` before the asset's first candle | Days before the first candle are `InsufficientData`; a period covering them is clamped. |
| Single data point after clamping | `effectiveFrom = to`: no daily return, `TWR` has no value, P/L is `0` (§7). |
| 90 seeded days, period `1Y` or `ALL` | Clamped; `effectiveFrom` reported (ADR-004, Consequences). |

---

# 6. Daily Return

**Status:** `Planned (B1)`  
**Decisions:** ADR-004 point 3 (corrected 2026-10-04).  
**Requirements:** FR-025, FR-026, FR-029.

```text
r(d) = (V(d) + S(d)) / (V(d−1) + B(d)) − 1

no return on d   when V(d−1) + B(d) = 0
```

Inflows count at the start of the day and outflows at the end, so the
denominator is never negative (it is a sum of non-negative terms, given §3
rule 3 and §4) and a sale is measured against the capital invested. Intraday
movement between the trade price and the previous close is ignored; this is a
documented approximation (ADR-004, Consequences).

"No return" is different from a zero return: the day is absent from the
return series. It contributes nothing to `TWR` (§7), is not a sample in
volatility (§9) and leaves the drawdown index unchanged (§10).

Hand-computed tests (required by ADR-004 point 3):

```text
Full liquidation above the previous close:
  V(d−1) = 100, everything sold for 110, fees 0
  V(d) = 0, S(d) = 110, B(d) = 0
  r(d) = (0 + 110) / (100 + 0) − 1 = +10%
  (the superseded formula V(d) / (V(d−1) + F(d)) − 1 gave 0 / −10 − 1 = −100%)

First-day purchase:
  V(d−1) = 0, BUY 10 @ 10 with fees 1, close 10.5
  B(d) = 101, V(d) = 105
  r(d) = 105 / 101 − 1 = +3.9604%   (fees reduce the return)
```

Edge cases:

| Case | Expected |
| --- | --- |
| Empty before and no purchase on `d` | Denominator `0`: no return. |
| Partial sale, no price move | `r(d) = 0` only when the sale price equals the previous close and fees are `0`. |
| Purchase and sale of the same asset on `d` | Both flows apply; result depends only on end-of-day `V(d)` and the day's sums. |
| Negative denominator | Impossible while §3 rule 3 and §4 hold; if `S(d) < 0` is allowed by the §4 open detail, a test must show the denominator stays `≥ 0`. |

---

# 7. Period Return and Period P/L

**Status:** `Planned (B1)`  
**Decisions:** ADR-004 point 4, Deferred detail (period boundaries).  
**Requirements:** FR-025, FR-026.

```text
TWR = Π_{d in period, d has a return} (1 + r(d)) − 1

Unclamped period [from, to]:
  P/L = V(to) − V(from−1) − Σ_{d = from..to} F(d)

Clamped period (effectiveFrom > from):
  P/L = V(to) − V(effectiveFrom) − Σ_{d in (effectiveFrom, to]} F(d)
```

The time-weighted return is the headline; `P/L` (`Money`) is the investor's
absolute result. Money-weighted return is not reported (ADR-004,
Alternatives).

Worked example (asset A, base currency USD):

```text
d1: BUY 10 @ 10, fees 1       close 10.5   V = 105   B = 101   S = 0
d2: no trade                  close 11     V = 110
d3: SELL 4 @ 11.5, fees 1     close 12     V = 72    B = 0     S = 45

r(d1) = (105 + 0) / (0 + 101) − 1   = 0.039604
r(d2) = 110 / 105 − 1               = 0.047619
r(d3) = (72 + 45) / (110 + 0) − 1   = 0.063636
TWR   = (105/101) × (110/105) × (117/110) − 1 = 117/101 − 1 = +15.8416%

P/L over [d1, d3] = 72 − 0 − (101 − 45) = 16
  (paid 101, received 45, still holds 72)
```

Edge cases:

| Case | Expected |
| --- | --- |
| No day in the period has a return | `TWR` has no value (not `0`); `P/L` is still defined. |
| Empty portfolio throughout | `P/L = 0`; `TWR` has no value (FR-058). |
| First-day flows | Counted once: `V(from−1)` excludes them and `Σ F` includes them (ADR-004 Deferred detail). |
| Clamped period | `V(effectiveFrom)` already includes that day's flows, so they are excluded from `Σ F`. |

Open detail (B1): `TWR` uses the same days as `P/L` (`r(d)` for `d` in
`[from, to]`, or `(effectiveFrom, to]` when clamped). ADR-004 fixes the
boundaries for P/L and attribution only; tests pin the `TWR` boundary.

---

# 8. Periods

**Status:** `Planned (B1)`; `1D` `Implemented`.  
**Decisions:** ADR-004 points 5 and 6.  
**Requirements:** FR-025.

| Period | Source |
| --- | --- |
| `1D` | `MarketPrice` (§11), not the daily series. |
| `1W`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `ALL` | Daily series (§3-§7). `YTD` starts on 1 January (UTC) of the year of `to`. |
| Custom `from` / `to` | Daily series, UTC dates, inclusive. |

FR-025 lists `1D`, `1W`, `1M`, `3M`, `6M`, `1Y` and custom with periods
"defined later"; ADR-004 point 5 settles them and adds `YTD` and `ALL`.

Open detail (B1):

- Exact window of `1W`/`1M`/`3M`/`6M`/`1Y` (calendar offset or fixed day
  count) and the start of `ALL` (first transaction day).
- A `to` later than the last closed day, and trades executed after the last
  closed day: the series ends at the last closed day (§3 rule 4); how the
  response states it.
- Validation of custom ranges (`from > to`, future dates) with
  `07-api-spec.md` §20.

---

# 9. Volatility

**Status:** asset-level `Implemented` (`volatility.ts`); portfolio-level `Planned (B1)`.  
**Decisions:** ADR-004 point 8 (√365, amended 2026-10-05).  
**Requirements:** FR-029.

```text
R      = the daily returns r(d) of the period (days with no return excluded)
n      = |R|, required n ≥ 20, otherwise UNKNOWN
mean   = Σ R / n
σ      = sqrt( Σ (r − mean)² / (n − 1) )          (sample standard deviation)
volatilityPercent = σ × A × 100
A      = √365 per ADR-004 point 8 (calendar-day series, §5)
```

`Implemented` today: `calculateVolatility` takes one asset's candles,
computes close-to-close returns, requires at least 3 prices (2 returns) and
throws `InsufficientDataError` below that, and annualizes with √252 only when
`annualize: true` (default daily). ADR-004 point 8 generalizes it to accept
a return series, raises the minimum to 20 returns and always annualizes
with √365.

Edge cases:

| Case | Expected |
| --- | --- |
| `n < 20` | `UNKNOWN`, no value. |
| All returns equal | `σ = 0`. |
| Days with no return | Excluded from `R` and from `n`. |
| Gaps filled by carry-forward | Produce zero price-change returns for held assets; they are samples. |

Test (B1): 20 alternating returns of `+0.01` and `−0.01` give
`σ = sqrt(20 × 0.0001 / 19) ≈ 0.0102598` and
`volatilityPercent ≈ 0.0102598 × √365 × 100 ≈ 19.601`. 19 returns give
`UNKNOWN`.

---

# 10. Drawdown

**Status:** asset-level `Implemented` (`drawdown.ts`); portfolio-level `Planned (B1)`.  
**Decisions:** ADR-004 point 9.  
**Requirements:** FR-028.

```text
I(start) = 1
I(d)     = I(d−1) × (1 + r(d))        (I(d) = I(d−1) when d has no return)
P(d)     = max_{t ≤ d} I(t)
DD(d)    = I(d) / P(d) − 1

maxDrawdown     = min_d DD(d), with the peak date and the trough date
currentDrawdown = DD(last day of the period)
```

Drawdown is computed on the cumulative return index, never on raw value, so
purchases and sales are not gains or losses (ADR-004, Alternatives).
`Implemented` asset-level `calculateDrawdown` uses closes, needs at least 2
prices, and returns `maxDrawdownPercent` as a negative percentage (`0` when
there is no decline) with `peakTimestamp` and `troughTimestamp`.

Hand-computed test:

```text
r = +10%, −20%, +5%
I = 1.10, 0.88, 0.924
maxDrawdown     = 0.88 / 1.10 − 1  = −20%   peak d1, trough d2
currentDrawdown = 0.924 / 1.10 − 1 = −16%
```

Edge cases:

| Case | Expected |
| --- | --- |
| Monotonically rising index | `maxDrawdown = 0`, `currentDrawdown = 0`. |
| Purchase on a down day | Only `r(d)` moves the index; the inflow does not. |

Open detail (B1): minimum number of returns for portfolio drawdown (asset
level requires 2 prices), and which peak is reported when two peaks are
equal (asset level keeps the first, since a new peak must be strictly
higher).

---

# 11. Daily Change (`1D`)

**Status:** `Implemented` (`portfolio-daily-change.ts`); tick semantics `Planned (B5)`.  
**Decisions:** ADR-004 point 5; ADR-007 points 8 and 14.  
**Requirements:** FR-025.

```text
changeValue   = Σ_positions MarketPrice.change × quantity
previousValue = Σ_positions MarketPrice.previousPrice × quantity
changePercent = changeValue / previousValue × 100     (0 when previousValue = 0)
```

Inputs: `Position.quantity` (§8 of `05-data-model.md`), `MarketPrice.change`
and `previousPrice` (§18). `previousPrice` is the last closed daily candle
(ADR-007, `Planned (B5)` under continuous ticking).

| Case | Expected (`Implemented`) |
| --- | --- |
| No positions | Zeroed result, `changePercent = 0`. |
| Some assets without `MarketPrice` | Skipped and listed in `excludedAssetIds`. |
| No asset has a `MarketPrice` | `InsufficientDataError`. |

---

# 12. Current-State Metrics and P/L

**Status:** unrealized `Implemented` (`portfolio-metrics.ts`, `position-metrics.ts`); realized `Planned (B1)`.  
**Decisions:** ADR-003 point 4; ADR-004 point 14.  
**Requirements:** FR-025, FR-030.

```text
marketValue(p)        = currentPrice × quantity
costBasis(p)          = averageEntryPrice × quantity
unrealizedPnL(p)      = marketValue(p) − costBasis(p)
unrealizedPnLPercent  = unrealizedPnL / costBasis × 100
portfolio totals      = Σ over positions; percent 0 when total cost basis is 0
```

`averageEntryPrice` is the weighted average cost of `BUY` prices; a `SELL`
leaves it unchanged (`position-recalculation.ts`, `Implemented`). `BUY` fees
are not part of it today.

**Realized P/L** (`Planned (B1)`, ADR-003 point 4): realized on each `SELL`
against the weighted-average cost at the time of the sale; sale proceeds
leave the portfolio.

```text
realizedPnL(SELL) = quantity × (price − averageEntryPrice at the sale)   (fees: Open detail)
```

Edge cases:

| Case | Expected |
| --- | --- |
| No positions | All totals zero in `baseCurrency`, percent `0` (`Implemented`, FR-058). |
| Zero cost basis on a position | `PositionMetricsCalculationError` (`Implemented`); unreachable while `price > 0`. |
| Backdated transactions | Average cost depends on date order; the projection must be rebuilt in date order (`05-data-model.md` §8, `Planned (B0)`). |

Open detail (B1): whether `BUY` and `SELL` fees enter realized P/L and
average cost. `Position.currentPrice` keeps the last trade price while
`MarketPrice` ticks (`05-data-model.md` §8, B5).

---

# 13. Allocation

**Status:** `Implemented` (`allocation.ts`, `apps/api/src/services/analytics.service.ts`); sector `Deferred`.  
**Decisions:** ADR-004 points 12 and 13.  
**Requirements:** FR-027.

```text
marketValue(group) = Σ_{p in group} currentPrice × quantity
percentage(group)  = marketValue(group) / Σ marketValue × 100     (0 when the total is 0)
```

- `groupBy`: `asset` (key `assetId`, label symbol), `assetType`, `currency`.
  Sector is `Deferred` (ADR-004 point 13); `Asset.metadata` is not used.
- Percentages are computed per group and not rebalanced to sum to exactly
  100; floating-point drift is accepted.
- Under the single-currency rule, `groupBy=currency` yields one group.

| Case | Expected (`Implemented`) |
| --- | --- |
| No positions | Empty group list (closes the `05-data-model.md` §26 open detail). |
| Total value `0` | Every percentage `0`; unreachable while `quantity > 0` and `price > 0`. |
| Asset missing from the lookup | `assetType` key `UNKNOWN`; label falls back to the key. |

---

# 14. Attribution

**Status:** current-state `Implemented` (`attribution.ts`); range attribution `Planned (B1)`.  
**Decisions:** ADR-004 point 10, Deferred detail (period boundaries).  
**Requirements:** FR-030, FR-031.

`Implemented` today: each position's contribution is its unrealized P/L, and
`percentageOfTotal = contribution / total unrealized P/L × 100` (`0` when the
total is `0`). Fees and realized results are not included.

Range attribution (`Planned (B1)`), using the §7 boundaries:

```text
V_a(d) = q(a, d) × c(a, d)
F_a(d) = B_a(d) − S_a(d)                  (§4 restricted to asset a)

Unclamped:  contribution(a) = V_a(to) − V_a(from−1)       − Σ_{d = from..to} F_a(d)
Clamped:    contribution(a) = V_a(to) − V_a(effectiveFrom) − Σ_{d in (effectiveFrom, to]} F_a(d)

Invariant:  Σ_a contribution(a) = P/L   (exactly, in Money)
```

Because `V = Σ V_a` and `F = Σ F_a`, contributions sum exactly to the period
P/L; a test asserts equality in `Money`, without tolerance. Fees and realized
results are included implicitly through the flows. There is no Brinson-style
decomposition (ADR-004 point 10). `groupBy` options exclude sector (ADR-004
point 13).

Hand-computed test (two assets, `[d1, d3]`):

```text
A: the §7 example                 contribution = 16
B: held throughout, no flows,
   V_B(d0) = 50, V_B(d3) = 45      contribution = −5
P/L = 11 = 16 + (−5)
```

Open detail (B1): whether range attribution reports a percentage of total
and how when `P/L = 0`; `groupBy` values other than sector are fixed with
`07-api-spec.md` §22.

---

# 15. Portfolio Pulse

**Status:** `Implemented` (`portfolio-pulse.ts`); real volatility and drawdown inputs `Planned (B1)`.  
**Decisions:** ADR-004 point 11.  
**Requirements:** FR-007.

`Implemented`: performance is classified from `unrealizedPnLPercent`,
concentration from the largest allocation by asset. Volatility and drawdown
come from the **largest position's** candles (proxy in
`apps/api/src/services/overview.service.ts`) and are `UNKNOWN` when absent.
Thresholds are placeholders, not product decisions.

`Planned (B1)`: volatility and drawdown come from the portfolio series (§9,
§10). `UNKNOWN` when §9 has fewer than 20 returns. Exposure and liquidity are
`Deferred` (`05-data-model.md` §29).

`Planned (B1)`: volatility thresholds apply to the annualized value
(ADR-004 point 11): `LOW` below 20%, `MODERATE` from 20% to below 60%,
`HIGH` from 60%. Boundary tests: 19.99 is `LOW`, 20 is `MODERATE`, 60 is
`HIGH`.

Open detail (B1): the look-back period of the Pulse inputs is unfixed.

---

# 16. Failure-Mode Review

**Status:** `Planned (B1)` (review of this specification, 2026-10-05)

The checklist in `docs/README.md` applied to the analytics.

| Category | Finding | Handling | Block |
| --- | --- | --- | --- |
| Concurrency | A transaction committed while a series is being read | Each read rebuilds the series from one consistent read of transactions and candles; nothing is stored, so no lost update. Read isolation follows the `UnitOfWork` rules (`06-architecture.md`). | B1 |
| Concurrency | Two transactions racing on one position | Affects the `Position` projection (§12, §13), not the series (§3 rule 2). | B0 |
| Crash and restart | Process dies mid-calculation | Analytics are read-only and derived; nothing to resume. | B1 |
| Crash and restart | Simulator offline for some days | Backfilled candles (ADR-007 point 8); otherwise carry-forward (§5). | B5 |
| Timeouts and expiry | Slow reconstruction over long histories | Timed separately (ADR-009 point 8); caching only when measured (ADR-004, Consequences). | B3, B1 |
| Retries and duplicates | Repeated analytics request | Idempotent: same inputs, same result. | B1 |
| Retries and duplicates | Duplicated candle | Prevented by the `(assetId, timestamp)` primary key (`05-data-model.md` §20). | Implemented |
| Boundary math and data edges | Zero denominator in `r(d)` | No return, not zero (§6). | B1 |
| Boundary math and data edges | Negative denominator | Impossible given non-negative holdings and `S(d) ≥ 0` (§3, §4). | B0, B1 |
| Boundary math and data edges | Same-timestamp transactions | No effect on daily sums (§3); tiebreak matters for validation only. | B0 |
| Boundary math and data edges | Single data point, fewer than 20 returns, empty portfolio | §5, §7, §9 edge tables. | B1 |
| Boundary math and data edges | Weekend and offline gaps; calendar vs trading days | Carry-forward (§5); √365 matches the calendar-day series (§9). | B1 |
| Boundary math and data edges | UTC day boundary in demo and server | UTC everywhere (§2). | B1 |
| Boundary math and data edges | Mixed currencies | 400 on write (§2); today 500. | B1 |
| Partial failure | Some held assets lack prices | Series: `InsufficientData` for the range or clamp (§5). `1D`: partial result with `excludedAssetIds` (§11). | B1, Implemented |

---

# 17. Gaps and Contradictions Reported

**Status:** reported, not resolved.

1. **Annualization.** Resolved 2026-10-05: ADR-004 point 8 now decides
   √365 (§9).
2. **FR-031 factors.** FR-031 asks to distinguish price movement, position
   size, fees and realized results. ADR-004 point 10 decides a single money
   contribution per asset with no decomposition; the factor breakdown is not
   decided. Align in T3.1.
3. **FR-025 periods.** FR-025 still says periods are "defined later" and
   omits `YTD` and `ALL`; ADR-004 point 5 settles them. Align in T3.1.
4. **Pulse thresholds.** Volatility resolved 2026-10-05: 20% and 60%,
   annualized (ADR-004 point 11, §15). The performance, concentration and
   drawdown thresholds are still placeholders in `portfolio-pulse.ts`.
5. **Decision replay money.** `decision-replay.ts` reads payload prices as
   numbers, against ADR-002 (task T2.5).
