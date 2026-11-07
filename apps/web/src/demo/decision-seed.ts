import type { Clock } from "@trading/application";
import { DecisionDirection, DecisionEventType, Money } from "@trading/domain";
import type {
  AssetRepository,
  DecisionEventRepository,
  DecisionRepository,
  Portfolio,
} from "@trading/domain";

const DAY_MS = 24 * 60 * 60 * 1000;

interface SeedEvent {
  /** How long before "now" the event happened. */
  readonly daysAgo: number;
  readonly type: DecisionEventType;
  readonly payload: Record<string, unknown>;
}

interface SeedDecision {
  readonly symbol: string;
  readonly title: string;
  readonly thesis: string;
  readonly direction: DecisionDirection;
  readonly entryPrice: string;
  readonly targetPrice: string;
  readonly stopPrice: string;
  readonly riskLevel: string;
  readonly notes: string;
  readonly daysAgo: number;
  readonly events: readonly SeedEvent[];
}

const SEED_DECISIONS: readonly SeedDecision[] = [
  {
    symbol: "AAPL",
    title: "Build a core Apple position",
    thesis: "Services growth and buybacks should keep supporting the price through the year.",
    direction: DecisionDirection.LONG,
    entryPrice: "172.40",
    targetPrice: "200.00",
    stopPrice: "160.00",
    riskLevel: "MEDIUM",
    notes: "Review after the next earnings report.",
    daysAgo: 26,
    events: [
      { daysAgo: 26, type: DecisionEventType.DECISION_CREATED, payload: {} },
      {
        daysAgo: 26,
        type: DecisionEventType.THESIS_RECORDED,
        payload: { thesis: "Services growth and buybacks should keep supporting the price." },
      },
      {
        daysAgo: 25,
        type: DecisionEventType.POSITION_OPENED,
        payload: { quantity: "20", price: "172.40" },
      },
      { daysAgo: 18, type: DecisionEventType.PRICE_UPDATE, payload: { price: "178.90" } },
      { daysAgo: 12, type: DecisionEventType.RISK_CHANGED, payload: { riskLevel: "LOW" } },
      {
        daysAgo: 6,
        type: DecisionEventType.NOTE_ADDED,
        payload: { note: "Held through the pullback; the thesis has not changed." },
      },
    ],
  },
  {
    symbol: "NVDA",
    title: "Short the AI rally into earnings",
    thesis: "Expectations look stretched, so a small pullback is likely once results are out.",
    direction: DecisionDirection.SHORT,
    entryPrice: "128.00",
    targetPrice: "112.00",
    stopPrice: "136.00",
    riskLevel: "HIGH",
    notes: "Closed at the target a few days after the report.",
    daysAgo: 20,
    events: [
      { daysAgo: 20, type: DecisionEventType.DECISION_CREATED, payload: {} },
      {
        daysAgo: 19,
        type: DecisionEventType.POSITION_OPENED,
        payload: { quantity: "40", price: "128.00" },
      },
      { daysAgo: 14, type: DecisionEventType.PRICE_UPDATE, payload: { price: "124.50" } },
      {
        daysAgo: 9,
        type: DecisionEventType.POSITION_ADJUSTED,
        payload: { quantity: "25", price: "119.20" },
      },
      { daysAgo: 7, type: DecisionEventType.TARGET_REACHED, payload: { price: "112.00" } },
      { daysAgo: 7, type: DecisionEventType.POSITION_CLOSED, payload: { price: "112.40" } },
    ],
  },
];

export interface DecisionSeedDependencies {
  readonly decisionRepository: Pick<DecisionRepository, "create" | "close">;
  readonly decisionEventRepository: Pick<DecisionEventRepository, "create">;
  readonly assetRepository: Pick<AssetRepository, "getBySymbol">;
  readonly portfolio: Portfolio;
  readonly clock: Clock;
}

/**
 * Two decisions with their history. The API has no operation to create a decision (they are written
 * elsewhere), so the demo records them straight in the repositories, with past dates.
 */
export async function seedDecisions(dependencies: DecisionSeedDependencies): Promise<void> {
  const { decisionRepository, decisionEventRepository, assetRepository, portfolio, clock } =
    dependencies;
  const ago = (days: number) => new Date(clock.now().getTime() - days * DAY_MS);
  const money = (amount: string) => Money.of(amount, portfolio.baseCurrency);

  for (const seed of SEED_DECISIONS) {
    const asset = await assetRepository.getBySymbol(seed.symbol);
    if (!asset) continue;

    const decision = await decisionRepository.create({
      portfolioId: portfolio.id,
      assetId: asset.id,
      title: seed.title,
      thesis: seed.thesis,
      direction: seed.direction,
      entryPrice: money(seed.entryPrice),
      targetPrice: money(seed.targetPrice),
      stopPrice: money(seed.stopPrice),
      riskLevel: seed.riskLevel,
      notes: seed.notes,
      createdAt: ago(seed.daysAgo),
    });

    for (const event of seed.events) {
      await decisionEventRepository.create({
        decisionId: decision.id,
        type: event.type,
        payload: event.payload,
        timestamp: ago(event.daysAgo),
      });
    }

    const closing = seed.events.find((event) => event.type === DecisionEventType.POSITION_CLOSED);
    if (closing) {
      await decisionRepository.close(decision.id, "Target reached", ago(closing.daysAgo));
    }
  }
}
