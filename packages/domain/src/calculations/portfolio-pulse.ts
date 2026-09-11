import type { Portfolio } from "../entities/portfolio";
import type { Position } from "../entities/position";
import type { DrawdownResult } from "./drawdown";
import type { VolatilityResult } from "./volatility";
import { calculateAllocation } from "./allocation";
import { calculatePortfolioMetrics } from "./portfolio-metrics";

/**
 * Portfolio Pulse calculation.
 * Source: docs/06-architecture.md §10, docs/01-product-spec.md §5.3,
 * docs/05-data-model.md §29, docs/02-functional-requirements.md FR-007.
 *
 * Combines multiple calculated signals into a deterministic,
 * explainable interpretation of portfolio state.
 *
 * SCOPE — dimensions included vs. excluded:
 *
 *   - Performance    → always calculated (from PortfolioMetrics).
 *   - Concentration  → always calculated (from calculateAllocation,
 *                      grouped by assetId).
 *   - Volatility     → OPTIONAL. calculateVolatility only operates at
 *                      asset level (see volatility.ts scope note), not
 *                      portfolio level. This function accepts an
 *                      already-calculated VolatilityResult from the
 *                      caller (e.g. for the largest position, or a
 *                      weighted average — that decision belongs to the
 *                      application layer, not this module). When not
 *                      provided, classified as "UNKNOWN" rather than
 *                      fabricating a value.
 *   - Drawdown       → OPTIONAL, same reasoning as Volatility above.
 *   - Exposure       → NOT INCLUDED. Neither `01-product-spec.md` nor
 *                      `05-data-model.md` §29 define what "exposure"
 *                      means distinctly from allocation/concentration
 *                      with the data available today. Adding it would
 *                      mean inventing an undefined metric.
 *   - Liquidity      → NOT INCLUDED. Mentioned in `01-product-spec.md`
 *                      §5.3 but absent from the definitive dimension
 *                      list in `05-data-model.md` §29, and there is no
 *                      liquidity-related field anywhere in the domain
 *                      model (no bid/ask spread, no volume-based
 *                      liquidity signal).
 *
 * THRESHOLDS: the numeric thresholds used below (e.g. what counts as
 * "high concentration") are ARBITRARY PLACEHOLDERS, not a validated
 * product decision. They exist so the classification is deterministic
 * and testable, per FR-007 ("classifications are generated from
 * deterministic rules"). They must not be presented as tuned business
 * thresholds until a real product decision sets them — see
 * 15-implementation-plan.md §2 ("Do not invent... business... metrics").
 */

export type PerformanceClassification = "POSITIVE" | "NEUTRAL" | "NEGATIVE";
export type ConcentrationClassification = "LOW" | "MODERATE" | "HIGH";
export type VolatilityClassification = "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
export type DrawdownClassification = "LOW" | "MODERATE" | "SEVERE" | "UNKNOWN";

export interface PulseDimension<TClassification extends string> {
  readonly classification: TClassification;
  readonly value: number | null;
  readonly explanation: string;
}

export interface PortfolioPulse {
  readonly performance: PulseDimension<PerformanceClassification>;
  readonly concentration: PulseDimension<ConcentrationClassification>;
  readonly volatility: PulseDimension<VolatilityClassification>;
  readonly drawdown: PulseDimension<DrawdownClassification>;
}

// Placeholder thresholds — see module-level comment above.
const PERFORMANCE_POSITIVE_THRESHOLD = 5;
const PERFORMANCE_NEGATIVE_THRESHOLD = -5;
const CONCENTRATION_HIGH_THRESHOLD = 50;
const CONCENTRATION_MODERATE_THRESHOLD = 25;
const VOLATILITY_HIGH_THRESHOLD = 3;
const VOLATILITY_MODERATE_THRESHOLD = 1;
const DRAWDOWN_SEVERE_THRESHOLD = -20;
const DRAWDOWN_MODERATE_THRESHOLD = -10;

function classifyPerformance(
  unrealizedPnLPercent: number,
): PulseDimension<PerformanceClassification> {
  if (unrealizedPnLPercent > PERFORMANCE_POSITIVE_THRESHOLD) {
    return {
      classification: "POSITIVE",
      value: unrealizedPnLPercent,
      explanation: `Unrealized P/L is +${unrealizedPnLPercent.toFixed(2)}%, above the ${String(PERFORMANCE_POSITIVE_THRESHOLD)}% positive threshold.`,
    };
  }

  if (unrealizedPnLPercent < PERFORMANCE_NEGATIVE_THRESHOLD) {
    return {
      classification: "NEGATIVE",
      value: unrealizedPnLPercent,
      explanation: `Unrealized P/L is ${unrealizedPnLPercent.toFixed(2)}%, below the ${String(PERFORMANCE_NEGATIVE_THRESHOLD)}% negative threshold.`,
    };
  }

  return {
    classification: "NEUTRAL",
    value: unrealizedPnLPercent,
    explanation: `Unrealized P/L is ${unrealizedPnLPercent.toFixed(2)}%, within the neutral range.`,
  };
}

function classifyConcentration(
  largestAllocationPercent: number | null,
): PulseDimension<ConcentrationClassification> {
  if (largestAllocationPercent === null) {
    return {
      classification: "LOW",
      value: null,
      explanation: "No positions held, so there is no concentration risk.",
    };
  }

  if (largestAllocationPercent > CONCENTRATION_HIGH_THRESHOLD) {
    return {
      classification: "HIGH",
      value: largestAllocationPercent,
      explanation: `The largest position represents ${largestAllocationPercent.toFixed(2)}% of the portfolio, above the ${String(CONCENTRATION_HIGH_THRESHOLD)}% high-concentration threshold.`,
    };
  }

  if (largestAllocationPercent > CONCENTRATION_MODERATE_THRESHOLD) {
    return {
      classification: "MODERATE",
      value: largestAllocationPercent,
      explanation: `The largest position represents ${largestAllocationPercent.toFixed(2)}% of the portfolio, a moderate concentration.`,
    };
  }

  return {
    classification: "LOW",
    value: largestAllocationPercent,
    explanation: `The largest position represents ${largestAllocationPercent.toFixed(2)}% of the portfolio, a low concentration.`,
  };
}

function classifyVolatility(
  volatility: VolatilityResult | undefined,
): PulseDimension<VolatilityClassification> {
  if (!volatility) {
    return {
      classification: "UNKNOWN",
      value: null,
      explanation: "No volatility data was provided for this portfolio's assets.",
    };
  }

  if (volatility.volatilityPercent > VOLATILITY_HIGH_THRESHOLD) {
    return {
      classification: "HIGH",
      value: volatility.volatilityPercent,
      explanation: `Volatility is ${volatility.volatilityPercent.toFixed(2)}%, above the ${String(VOLATILITY_HIGH_THRESHOLD)}% high-volatility threshold.`,
    };
  }

  if (volatility.volatilityPercent > VOLATILITY_MODERATE_THRESHOLD) {
    return {
      classification: "MODERATE",
      value: volatility.volatilityPercent,
      explanation: `Volatility is ${volatility.volatilityPercent.toFixed(2)}%, a moderate level.`,
    };
  }

  return {
    classification: "LOW",
    value: volatility.volatilityPercent,
    explanation: `Volatility is ${volatility.volatilityPercent.toFixed(2)}%, a low level.`,
  };
}

function classifyDrawdown(
  drawdown: DrawdownResult | undefined,
): PulseDimension<DrawdownClassification> {
  if (!drawdown) {
    return {
      classification: "UNKNOWN",
      value: null,
      explanation: "No drawdown data was provided for this portfolio's assets.",
    };
  }

  if (drawdown.maxDrawdownPercent < DRAWDOWN_SEVERE_THRESHOLD) {
    return {
      classification: "SEVERE",
      value: drawdown.maxDrawdownPercent,
      explanation: `Maximum drawdown is ${drawdown.maxDrawdownPercent.toFixed(2)}%, below the ${String(DRAWDOWN_SEVERE_THRESHOLD)}% severe threshold.`,
    };
  }

  if (drawdown.maxDrawdownPercent < DRAWDOWN_MODERATE_THRESHOLD) {
    return {
      classification: "MODERATE",
      value: drawdown.maxDrawdownPercent,
      explanation: `Maximum drawdown is ${drawdown.maxDrawdownPercent.toFixed(2)}%, a moderate decline.`,
    };
  }

  return {
    classification: "LOW",
    value: drawdown.maxDrawdownPercent,
    explanation: `Maximum drawdown is ${drawdown.maxDrawdownPercent.toFixed(2)}%, a low decline.`,
  };
}

export interface CalculatePortfolioPulseOptions {
  readonly volatility?: VolatilityResult;
  readonly drawdown?: DrawdownResult;
}

/**
 * Calculates a deterministic, explainable interpretation of a
 * portfolio's current state across performance, concentration, and
 * (when provided) volatility/drawdown.
 *
 * An empty positions array is valid: performance is neutral (0%),
 * concentration is LOW (no concentration risk with nothing held).
 */
export function calculatePortfolioPulse(
  portfolio: Portfolio,
  positions: readonly Position[],
  options: CalculatePortfolioPulseOptions = {},
): PortfolioPulse {
  const portfolioMetrics = calculatePortfolioMetrics(portfolio, positions);
  const allocation = calculateAllocation(positions, (p) => p.assetId);

  const largestAllocationPercent =
    allocation.length === 0 ? null : Math.max(...allocation.map((group) => group.percentage));

  return {
    performance: classifyPerformance(portfolioMetrics.unrealizedPnLPercent),
    concentration: classifyConcentration(largestAllocationPercent),
    volatility: classifyVolatility(options.volatility),
    drawdown: classifyDrawdown(options.drawdown),
  };
}
