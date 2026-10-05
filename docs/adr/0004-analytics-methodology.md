# ADR-004: Portfolio Analytics Methodology

**Status:** Accepted
**Date:** 2026-10-04
**Implemented in:** roadmap block B1 (not yet implemented)
**Detailed specification:** `16-analytics-spec.md` (formulas, edge cases,
hand-computed examples)

## Context

FR-025 (portfolio performance, P0) leaves its periods "defined later".
FR-028 (drawdown) and FR-029 (volatility) defer their methodology to an
analytics specification that does not exist. `07-api-spec.md` §20-22 lists
performance, risk, pulse and attribution endpoints without formulas.

The domain has the building blocks, but only at asset level:

- `calculateVolatility` computes the sample standard deviation of daily
  close-to-close returns of one asset, optionally annualized with
  √252 (`packages/domain/src/calculations/volatility.ts`).
- `calculateDrawdown` computes the maximum peak-to-trough decline of one
  asset's closes (`packages/domain/src/calculations/drawdown.ts`).

Applying them to raw portfolio value would be wrong: a purchase raises the
value without being a gain, and a sale lowers it without being a loss.
ADR-003 established that every `BUY` is an external inflow and every `SELL`
an external outflow.

Two further facts shape the decision:

- There is no foreign-exchange data. Portfolio metrics assume one currency;
  mixed currencies make `Money.add` throw `CurrencyMismatchError`, which
  currently surfaces as a 500. All seed data is in USD.
- Assets have no sector field; `metadata` is untyped JSON.

## Decision

1. **Value series.** The daily portfolio value is
   `V(d) = Σ quantityHeld(asset, end of d) × close(asset, d)`, reconstructed
   from transactions and daily `HistoricalPrice` candles. Candles come from
   the seed and from the simulator's daily closes (ADR-007 point 8), so the
   series reaches the last closed day.
   *Point 1 corrected on 2026-10-04 after a systematic audit:* candles
   previously came from the seed only, so the series stopped at a fixed
   date and recent purchases were valued at a stale carried-forward close.
2. **Cash flows.** For day `d`, inflows are
   `B(d) = Σ BUY (quantity × price + fees)` and outflows are
   `S(d) = Σ SELL (quantity × price − fees)`. The net flow is
   `F(d) = B(d) − S(d)`. Fees therefore reduce the return.
3. **Daily return.** `r(d) = (V(d) + S(d)) / (V(d−1) + B(d)) − 1`. Inflows
   are treated as occurring at the start of the day and outflows at the end
   of the day, so the denominator can never be negative and a sale is
   measured against the capital that was invested. Intraday movement between
   the trade price and the previous close is otherwise ignored; this
   simplification is documented. When the denominator is zero (empty
   portfolio and no purchases that day), the day has no return, which is
   different from a zero return. Required hand-computed tests include a full
   liquidation above the previous close (`V(d−1) = 100`, everything sold for
   `110`, `r(d) = +10%`) and a first-day purchase.
   *Corrected on 2026-10-04 after review:* the original formula,
   `V(d) / (V(d−1) + F(d)) − 1` with all flows at the start of the day, gave
   a negative denominator on such a sale and reported −100%.
   The non-negative denominator also relies on holdings never being negative
   on any day, which ADR-003's chronological validation guarantees.
   *Point 3 corrected on 2026-10-04 after a systematic audit:* a backdated
   `SELL` checked only against the current position could leave historical
   holdings negative, making `V(d)` negative.
4. **Period return.** Time-weighted return: `TWR = Π (1 + r(d)) − 1`. The
   absolute profit or loss for the period is also reported:
   `P/L = V(end) − V(start) − Σ F(d)`.
5. **Periods.** `1W`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `ALL` and a custom
   `from`/`to` range. `1D` comes from `MarketPrice`, as the existing
   `dailyChange` does.
6. **Insufficient history.** A period that starts before the first available
   data is clamped to it, and the response states the `effectiveFrom` date.
   Values are never extrapolated.
7. **Missing prices.** The last known close is carried forward. If an asset
   held on a day has never had a price on or before that day, that range is
   `InsufficientData`.
8. **Volatility.** Sample standard deviation of the daily TWR returns,
   annualized with √365, expressed as a percentage. At least 20 daily returns
   are required; otherwise the result is `UNKNOWN`. The existing calculation
   is generalized to accept a return series. (Amended 2026-10-05: originally
   √252. The return series is built on UTC calendar days with carry-forward
   prices (point 7), and the simulator closes a candle every calendar day
   (ADR-007), so the factor matches the series frequency. A trading-day
   series was rejected: it needs a holiday calendar per market and treats
   crypto, which trades every day, differently.)
9. **Drawdown.** Computed on the cumulative return index (growth of 1), not
   on raw value. Reports maximum drawdown with peak and trough dates, and the
   current drawdown.
10. **Attribution over a range.** The contribution of each asset in money is
    its value change minus its own flows over the period. Contributions sum
    exactly to the period P/L. No Brinson-style decomposition.
11. **Pulse.** Uses the portfolio's real volatility and drawdown instead of
    the current proxy based on the largest position. Volatility thresholds
    apply to the annualized value of point 8: `LOW` below 20%, `MODERATE`
    from 20% to below 60%, `HIGH` from 60%. (Amended 2026-10-05: they
    replace the daily placeholders of 1% and 3%, which annualize with √365 to
    about 19% and 57%.)
12. **Currency.** Version 1 is single-currency. A transaction on an asset
    whose currency differs from the portfolio's base currency is rejected
    with 400. Multi-currency support is `Deferred` until foreign-exchange
    data exists.
13. **Sector.** `Deferred`. Removed from allocation and attribution
    `groupBy` options until a typed sector field exists.
14. **Precision.** Values and flows use `Money` (decimal). Returns, ratios
    and percentages are JSON numbers, consistent with ADR-002.

## Consequences

**Positive**

- FR-025 to FR-029 become implementable without inventing anything.
- Returns are not distorted by deposits of capital through purchases.
- Every metric is testable against hand-computed examples.
- The single-currency rule closes a path that currently ends in a 500.

**Negative**

- Daily granularity and the flow timing convention make returns an
  approximation on days with trades.
- Reconstructing the series on every request may be slow for long histories;
  caching is not introduced until measured (`15-implementation-plan.md`
  rule 1).
- With 90 days of seeded history, `1Y` and longer periods report a clamped
  `effectiveFrom`.

## Alternatives Considered

- **Money-weighted return (IRR / Modified Dietz) as the headline metric.**
  Reflects the investor's timing rather than portfolio performance, and
  needs iterative solving. Rejected as headline; the absolute P/L covers the
  investor view.
- **Simple return on invested capital.** Easy, but misleading once positions
  are added or reduced over time. Rejected.
- **Drawdown on raw value.** Treats purchases and sales as gains and losses.
  Rejected.
- **Converting currencies with fixed or invented rates.** Fabricated data.
  Rejected.

## Deferred detail

Implementation edge cases that do not change this decision. Each is
specified and tested in the listed block.

| Item | Resolution | Block |
|---|---|---|
| `SELL` fees larger than the gross proceeds make `S(d)` negative. | Reject `SELL` fees greater than the gross proceeds, or count the excess as an inflow. | B1 |
| Period P/L boundaries are undefined, so first-day flows are double-counted. | P/L uses `V(day before from)` and flows over `[from, to]`. When clamped, it uses `V(effectiveFrom)` and flows over `(effectiveFrom, to]`, where `effectiveFrom` is the first day every held asset has a price. Attribution uses the same boundaries. | B1 |
| `calculateVolatility` annualizes with √252, only when `annualize: true`, and accepts 2 returns. | Point 8: always annualize with √365 and require 20 returns. Pulse volatility thresholds become 20% and 60% (point 11). Tests cover 19 vs 20 returns and a hand-computed annualized value. | B1 |
| Day and `YTD` boundaries have no timezone, so the server and the browser demo can disagree. | Day boundaries are UTC calendar dates everywhere, including the demo and the simulator clock. | B1 |

## Related

- ADR-003 (holdings-only portfolio, chronological validation)
- ADR-007 (simulator daily candles)
- `02-functional-requirements.md` FR-025 to FR-031
- `07-api-spec.md` §20-22
- `16-analytics-spec.md` (to be written in Phase 2)
