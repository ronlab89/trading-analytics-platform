import { ScenarioStatus } from "@trading/domain";
import type { AssetRepository, Portfolio, ScenarioRepository } from "@trading/domain";

interface SeedScenario {
  readonly name: string;
  readonly description: string;
  readonly status: ScenarioStatus;
  /** Percentage change on the price of each asset, by symbol. */
  readonly changes: readonly { readonly symbol: string; readonly percentChange: number }[];
}

/** Only assets the first portfolio holds, so every scenario calculates with nothing unmatched. */
const SEED_SCENARIOS: readonly SeedScenario[] = [
  {
    name: "Tech sell-off",
    description: "Large tech names give back part of the year's gains.",
    status: ScenarioStatus.SAVED,
    changes: [
      { symbol: "AAPL", percentChange: -12 },
      { symbol: "MSFT", percentChange: -15 },
    ],
  },
  {
    name: "Crypto rally",
    description: "Bitcoin extends its run after a strong month.",
    status: ScenarioStatus.SAVED,
    changes: [{ symbol: "BTC", percentChange: 25 }],
  },
  {
    name: "Rate cut rebound",
    description: "A rate cut lifts growth stocks.",
    status: ScenarioStatus.DRAFT,
    changes: [
      { symbol: "AAPL", percentChange: 6 },
      { symbol: "MSFT", percentChange: 8 },
    ],
  },
];

export interface ScenarioSeedDependencies {
  readonly scenarioRepository: Pick<ScenarioRepository, "create">;
  readonly assetRepository: Pick<AssetRepository, "getBySymbol">;
  readonly portfolio: Portfolio;
}

/** Writes straight to the repository, like the alerts: the scenarios exist before the first call. */
export async function seedScenarios(dependencies: ScenarioSeedDependencies): Promise<void> {
  const { scenarioRepository, assetRepository, portfolio } = dependencies;

  for (const seed of SEED_SCENARIOS) {
    const changes = [];
    for (const change of seed.changes) {
      const asset = await assetRepository.getBySymbol(change.symbol);
      if (asset) changes.push({ assetId: asset.id, percentChange: change.percentChange });
    }
    await scenarioRepository.create({
      portfolioId: portfolio.id,
      name: seed.name,
      description: seed.description,
      status: seed.status,
      changes,
    });
  }
}
