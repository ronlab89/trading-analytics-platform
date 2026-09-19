import { DecisionDirection, DecisionEventType, Money } from "@trading/domain";

export interface DecisionEventBlueprint {
  /**
   * Narrative-only ordering aid — NOT passed to `decisionEventRepository.create()`.
   * `CreateDecisionEventInput` does not accept `timestamp` (repository always
   * assigns it, per PROGRESS.md "timestamp always repository-assigned"), so
   * the persisted timestamp will be the moment the seed script ran, not this
   * date. Kept here so the blueprint reads as a coherent chronological story.
   */
  readonly type: DecisionEventType;
  readonly timestamp: Date;
  readonly payload?: Record<string, unknown>;
}

export interface DecisionBlueprint {
  readonly portfolioName: string;
  readonly assetSymbol: string;
  readonly title: string;
  readonly thesis: string;
  readonly direction: DecisionDirection;
  readonly entryPrice: Money;
  readonly targetPrice: Money;
  readonly stopPrice: Money;
  readonly riskLevel: string;
  /**
   * Narrative anchor for `events[].timestamp` below — NOT passed to
   * `decisionRepository.create()`. `CreateDecisionInput` does not accept
   * `createdAt` (the schema sets it via @default(now())), so the actual
   * persisted `createdAt` will be the seed run's timestamp, not this date.
   */
  readonly createdAt: Date;
  readonly closedAt: Date;
  readonly outcome: string;
  readonly notes?: string;
  readonly events: readonly DecisionEventBlueprint[];
}

/**
 * Source: 01-product-spec.md §14 (Decision Replay), paired with the
 * AAPL/MSFT positions already seeded in Step 6.3 for narrative coherence
 * (same entry prices and dates as the corresponding transactions).
 */
export const SEED_DECISIONS: readonly DecisionBlueprint[] = [
  {
    portfolioName: "Main Portfolio",
    assetSymbol: "AAPL",
    title: "AAPL breakout above the 50-day average",
    thesis:
      "Price reclaimed the 50-day moving average on rising volume; expecting continuation toward the mid-$180s.",
    direction: DecisionDirection.LONG,
    entryPrice: Money.of(150, "USD"),
    targetPrice: Money.of(185, "USD"),
    stopPrice: Money.of(140, "USD"),
    riskLevel: "MODERATE",
    createdAt: new Date("2026-06-01T14:00:00Z"),
    closedAt: new Date("2026-08-15T16:00:00Z"),
    outcome: "Target reached — closed near $184, in line with the $185 target.",
    events: [
      { type: DecisionEventType.DECISION_CREATED, timestamp: new Date("2026-06-01T14:00:00Z") },
      {
        type: DecisionEventType.THESIS_RECORDED,
        timestamp: new Date("2026-06-01T14:05:00Z"),
        payload: { thesis: "50-day reclaim with rising volume." },
      },
      {
        type: DecisionEventType.POSITION_OPENED,
        timestamp: new Date("2026-06-01T14:30:00Z"),
        payload: { quantity: 10, price: 150 },
      },
      {
        type: DecisionEventType.PRICE_UPDATE,
        timestamp: new Date("2026-07-10T12:00:00Z"),
        payload: { price: 165.5 },
      },
      {
        type: DecisionEventType.TARGET_REACHED,
        timestamp: new Date("2026-08-15T16:00:00Z"),
        payload: { price: 184.22 },
      },
    ],
  },
  {
    portfolioName: "Main Portfolio",
    assetSymbol: "MSFT",
    title: "MSFT pullback entry ahead of earnings",
    thesis: "Expected an oversold bounce off the $415 support level ahead of quarterly earnings.",
    direction: DecisionDirection.LONG,
    entryPrice: Money.of(420, "USD"),
    targetPrice: Money.of(450, "USD"),
    stopPrice: Money.of(400, "USD"),
    riskLevel: "MODERATE",
    createdAt: new Date("2026-05-15T15:00:00Z"),
    closedAt: new Date("2026-07-20T13:30:00Z"),
    outcome: "Stopped out — support broke down after weak earnings guidance.",
    notes: "Should have waited for post-earnings guidance before entering.",
    events: [
      { type: DecisionEventType.DECISION_CREATED, timestamp: new Date("2026-05-15T15:00:00Z") },
      {
        type: DecisionEventType.THESIS_RECORDED,
        timestamp: new Date("2026-05-15T15:05:00Z"),
        payload: { thesis: "Oversold bounce expected off $415 support." },
      },
      {
        type: DecisionEventType.POSITION_OPENED,
        timestamp: new Date("2026-05-15T15:30:00Z"),
        payload: { quantity: 5, price: 420 },
      },
      {
        type: DecisionEventType.PRICE_UPDATE,
        timestamp: new Date("2026-07-05T10:00:00Z"),
        payload: { price: 398 },
      },
      {
        type: DecisionEventType.POSITION_CLOSED,
        timestamp: new Date("2026-07-20T13:30:00Z"),
        payload: { price: 385 },
      },
    ],
  },
];
