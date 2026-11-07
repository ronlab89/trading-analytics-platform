import { AlertType } from "@trading/domain";
import type { AlertRepository, AssetRepository, Portfolio } from "@trading/domain";

interface SeedAlert {
  readonly type: AlertType;
  /** Asset symbol of a price alert; a portfolio alert has none. */
  readonly symbol?: string;
  readonly condition: string;
  readonly threshold: number;
  readonly enabled: boolean;
}

/**
 * None of them has fired yet. The enabled price alerts sit about 1% from the seed prices, so the
 * simulation can fire one within minutes of a visit.
 */
const SEED_ALERTS: readonly SeedAlert[] = [
  { type: AlertType.PRICE, symbol: "AAPL", condition: "ABOVE", threshold: 191, enabled: true },
  { type: AlertType.PRICE, symbol: "BTC", condition: "BELOW", threshold: 66800, enabled: true },
  { type: AlertType.PORTFOLIO_CHANGE, condition: "BELOW", threshold: -5, enabled: true },
  { type: AlertType.PRICE, symbol: "MSFT", condition: "ABOVE", threshold: 450, enabled: false },
];

export interface AlertSeedDependencies {
  readonly alertRepository: Pick<AlertRepository, "create">;
  readonly assetRepository: Pick<AssetRepository, "getBySymbol">;
  readonly userId: string;
  readonly portfolio: Portfolio;
}

/** Writes straight to the repository, like the decisions: the alerts exist before the first call. */
export async function seedAlerts(dependencies: AlertSeedDependencies): Promise<void> {
  const { alertRepository, assetRepository, userId, portfolio } = dependencies;

  for (const seed of SEED_ALERTS) {
    if (seed.symbol === undefined) {
      await alertRepository.create({
        userId,
        type: seed.type,
        portfolioId: portfolio.id,
        condition: seed.condition,
        threshold: seed.threshold,
        enabled: seed.enabled,
        armed: true,
      });
      continue;
    }

    const asset = await assetRepository.getBySymbol(seed.symbol);
    if (!asset) continue;
    await alertRepository.create({
      userId,
      type: seed.type,
      assetId: asset.id,
      condition: seed.condition,
      threshold: seed.threshold,
      enabled: seed.enabled,
      armed: true,
    });
  }
}
